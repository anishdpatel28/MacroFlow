const { app, BrowserWindow, Menu, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");
const isDev = process.env.NODE_ENV === "development";

// Read package.json for version
const packageJsonPath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const VERSION = packageJson.version;

const args = process.argv.slice(2);
const command = args[0];
const macroName = args[1];
const macroParams = args.slice(2);

// CLI mode flag
const isCliMode = command === "run-macro" || command === "--v" || command === "--version" || command === "--help" || command === "-v" || command === "-version" || command === "-help" || command === "-h";

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: isDev ? false : true,
      allowRunningInsecureContent: false,
      preload: path.join(__dirname, "preload.js"),
    },
    icon: path.join(__dirname, "assets/icon.png"),
    titleBarStyle: "default",
    show: false,
  });

  mainWindow.webContents.session.webRequest.onHeadersReceived(
    (details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [
            "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' http://localhost:3000 ws://localhost:3000;",
          ],
        },
      });
    }
  );

  if (isDev) {
    mainWindow.loadURL("http://localhost:3000");
    mainWindow.webContents.openDevTools();
    
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.log('Failed to load development server:', errorDescription);
      setTimeout(() => {
        mainWindow.loadURL("http://localhost:3000");
      }, 2000);
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../build/index.html"));
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "New Macro",
          accelerator: "CmdOrCtrl+N",
          click: () => {
            mainWindow.webContents.send("menu-action", "new-macro");
          },
        },
        {
          label: "Import Macros",
          accelerator: "CmdOrCtrl+I",
          click: () => {
            mainWindow.webContents.send("menu-action", "import-macros");
          },
        },
        {
          label: "Export Macros",
          accelerator: "CmdOrCtrl+E",
          click: () => {
            mainWindow.webContents.send("menu-action", "export-macros");
          },
        },
        { type: "separator" },
        {
          label: "Quit",
          accelerator: process.platform === "darwin" ? "Cmd+Q" : "Ctrl+Q",
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: [{ role: "minimize" }, { role: "close" }],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "About MacroFlow",
          click: () => {
            mainWindow.webContents.send("menu-action", "about");
          },
        },
        {
          label: "Documentation",
          click: () => {
            shell.openExternal("https://github.com/yourusername/macroflow");
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

ipcMain.handle("execute-macro", async (event, macro) => {
  return new Promise((resolve, reject) => {
    const { commands, executionMode, parameters } = macro;
    
    if (executionMode === "concurrent") {
      const promises = commands.map((command, index) => {
        return new Promise((cmdResolve, cmdReject) => {
          const processedCommand = processCommandWithParameters(command, parameters);
          exec(processedCommand, (error, stdout, stderr) => {
            if (error) {
              cmdReject({ command: processedCommand, error: error.message, stderr });
            } else {
              cmdResolve({ command: processedCommand, stdout, stderr });
            }
          });
        });
      });
      
      Promise.allSettled(promises)
        .then(results => {
          resolve(results);
        })
        .catch(reject);
    } else {
      let currentIndex = 0;
      const results = [];
      
      const executeNext = () => {
        if (currentIndex >= commands.length) {
          resolve(results);
          return;
        }
        
        const command = commands[currentIndex];
        const processedCommand = processCommandWithParameters(command, parameters);
        
        exec(processedCommand, (error, stdout, stderr) => {
          if (error) {
            results.push({ command: processedCommand, error: error.message, stderr });
            resolve(results);
          } else {
            results.push({ command: processedCommand, stdout, stderr });
            currentIndex++;
            executeNext();
          }
        });
      };
      
      executeNext();
    }
  });
});

ipcMain.handle("save-macros", async (event, macros) => {
  try {
    const userDataPath = app.getPath('userData');
    const macrosPath = path.join(userDataPath, 'macroflow-macros.json');
    fs.writeFileSync(macrosPath, JSON.stringify(macros, null, 2));
    return { success: true };
  } catch (error) {
    console.error('Error saving macros:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("execute-command", async (event, command) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        resolve({ error: error.message, stderr });
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
});

ipcMain.handle("check-macro-command", async (event) => {
  return new Promise((resolve, reject) => {
    exec("which macro", (error, stdout, stderr) => {
      if (error || !stdout.trim()) {
        resolve({ installed: false });
      } else {
        resolve({ installed: true, path: stdout.trim() });
      }
    });
  });
});

ipcMain.handle("get-version", async (event) => {
  return VERSION;
});

ipcMain.handle("install-macroflow-command", async (event) => {
  return new Promise(async (resolve, reject) => {
    try {
      let appPath;
      if (isDev) {
        appPath = path.join(process.cwd(), 'node_modules', '.bin', 'electron');
        const mainJsPath = path.join(process.cwd(), 'electron', 'main.js');
        appPath = `"${appPath}" "${mainJsPath}"`;
      } else {
        appPath = app.getPath('exe');
      }
      
      const globalScript = "/usr/local/bin/macro";
      const scriptContent = `#!/bin/bash
# MacroFlow Global Command
# Usage: macro <macro-name> [parameters...]

# Get the MacroFlow app path
MACROFLOW_APP="${appPath}"

if [ $# -eq 0 ]; then
    echo "Usage: macro <macro-name> [parameters...]"
    exit 1
fi

MACRO_NAME="$1"
shift
PARAMS="$@"

# Execute the macro through MacroFlow
${isDev ? 'cd "' + process.cwd() + '" && ' : ''}"$MACROFLOW_APP" run-macro "$MACRO_NAME" $PARAMS
`;

      const tempScript = path.join(app.getPath('temp'), 'macroflow-install.sh');
      fs.writeFileSync(tempScript, scriptContent);
      
      const osascriptCommand = `osascript -e 'do shell script "cp ${tempScript} ${globalScript} && chmod +x ${globalScript}" with administrator privileges'`;
      
      exec(osascriptCommand, (error, stdout, stderr) => {
        try {
          fs.unlinkSync(tempScript);
        } catch (e) {
        }
        
        if (error) {
          resolve({ error: error.message, stderr });
        } else {
          resolve({ success: true, stdout });
        }
      });
    } catch (error) {
      resolve({ error: error.message });
    }
  });
});

function processCommandWithParameters(command, parameters) {
  let processedCommand = command;
  
  if (parameters) {
    Object.keys(parameters).forEach(key => {
      const placeholder = `{{${key}}}`;
      processedCommand = processedCommand.replace(new RegExp(placeholder, 'g'), parameters[key]);
    });
  }
  
  return processedCommand;
}

function showVersion() {
  console.log(`MacroFlow v${VERSION}`);
  app.quit();
}

function showHelp() {
  console.log(`MacroFlow v${VERSION}`);
  console.log('A powerful macro management tool for developers');
  console.log('');
  console.log('Usage:');
  console.log('  macro <macro-name> [parameters...]    Run a macro');
  console.log('  macro --v, --version                  Show version');
  console.log('  macro --help                          Show this help');
  console.log('');
  console.log('Examples:');
  console.log('  macro test                            Run macro named "test"');
  console.log('  macro deploy staging                  Run macro named "deploy" with parameter "staging"');
  console.log('  macro build /path/to/project          Run macro named "build" with path parameter');
  console.log('');
  console.log('For more information, visit: https://github.com/yourusername/macroflow');
  app.quit();
}

async function runMacroFromCLI(macroName, params) {
  try {
    const userDataPath = app.getPath('userData');
    const macrosPath = path.join(userDataPath, 'macroflow-macros.json');
    
    let macros = [];
    if (fs.existsSync(macrosPath)) {
      const data = fs.readFileSync(macrosPath, 'utf8');
      macros = JSON.parse(data);
    }
    
    const macro = macros.find(m => m.name === macroName);
    if (!macro) {
      console.error(`Macro "${macroName}" not found`);
      console.log("Available macros:");
      macros.forEach(m => console.log(`  - ${m.name}`));
      app.quit();
      return;
    }
    
    const parameters = {};
    if (macro.parameters && macro.parameters.length > 0) {
      macro.parameters.forEach((param, index) => {
        parameters[param] = params[index] || "";
      });
    }
    
    console.log(`🚀 Running macro: ${macro.name}`);
    console.log(`📋 Commands: ${macro.commands.length}`);
    console.log(`⚡ Mode: ${macro.executionMode}`);
    
    const results = await executeMacro(macro, parameters);
    
    console.log("\n📊 Execution Results:");
    results.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.command}`);
      if (result.error) {
        console.log(`   ❌ Error: ${result.error}`);
      } else {
        console.log(`   ✅ Success`);
        if (result.stdout) {
          console.log(`   📤 Output: ${result.stdout.trim()}`);
        }
      }
    });
    
    macro.lastRun = new Date().toISOString();
    fs.writeFileSync(macrosPath, JSON.stringify(macros, null, 2));
    
    console.log("\n✅ Macro execution completed");
    app.quit();
    
  } catch (error) {
    console.error(`❌ Error running macro: ${error.message}`);
    app.quit();
  }
}

async function executeMacro(macro, parameters) {
  return new Promise((resolve, reject) => {
    const { commands, executionMode } = macro;
    
    if (executionMode === "concurrent") {
      const promises = commands.map((command, index) => {
        return new Promise((cmdResolve, cmdReject) => {
          const processedCommand = processCommandWithParameters(command, parameters);
          exec(processedCommand, (error, stdout, stderr) => {
            if (error) {
              cmdReject({ command: processedCommand, error: error.message, stderr });
            } else {
              cmdResolve({ command: processedCommand, stdout, stderr });
            }
          });
        });
      });
      
      Promise.allSettled(promises)
        .then(results => {
          resolve(results.map(result => 
            result.status === 'fulfilled' ? result.value : result.reason
          ));
        })
        .catch(reject);
    } else {
      let currentIndex = 0;
      const results = [];
      
      const executeNext = () => {
        if (currentIndex >= commands.length) {
          resolve(results);
          return;
        }
        
        const command = commands[currentIndex];
        const processedCommand = processCommandWithParameters(command, parameters);
        
        exec(processedCommand, (error, stdout, stderr) => {
          if (error) {
            results.push({ command: processedCommand, error: error.message, stderr });
            resolve(results);
          } else {
            results.push({ command: processedCommand, stdout, stderr });
            currentIndex++;
            executeNext();
          }
        });
      };
      
      executeNext();
    }
  });
}

app.whenReady().then(() => {
  if (isCliMode) {
    // CLI mode - no GUI needed
    if (command === "--v" || command === "--version" || command === "-v" || command === "-version") {
      showVersion();
    } else if (command === "--help" || command === "-help" || command === "-h") {
      showHelp();
    } else if (command === "run-macro" && macroName) {
      runMacroFromCLI(macroName, macroParams);
    } else {
      console.log('Invalid command. Use --help for usage information.');
      app.quit();
    }
  } else {
    // GUI mode
    createWindow();
    createMenu();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" || isCliMode) {
    app.quit();
  }
});

// Skip single instance lock for CLI mode to allow concurrent macro executions
if (!isCliMode) {
  const gotTheLock = app.requestSingleInstanceLock();

  if (!gotTheLock) {
    app.quit();
  } else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    });
  }
}

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  if (!isDev) {
    app.quit();
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  if (!isDev) {
    app.quit();
  }
});

app.on("web-contents-created", (event, contents) => {
  contents.on("new-window", (newEvent, navigationUrl) => {
    newEvent.preventDefault();
    require("electron").shell.openExternal(navigationUrl);
  });
});
