const { app, BrowserWindow, Menu, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");
const isDev = process.env.NODE_ENV === "development";

// Handle command line arguments
const args = process.argv.slice(2);
const command = args[0];
const macroName = args[1];
const macroParams = args.slice(2);

let mainWindow;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      preload: path.join(__dirname, "preload.js"),
    },
    icon: path.join(__dirname, "assets/icon.png"),
    titleBarStyle: "default",
    show: false,
  });

  // Set Content Security Policy
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

  // Load the app
  if (isDev) {
    // In development, load from webpack dev server
    mainWindow.loadURL("http://localhost:3000");
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built React app
    mainWindow.loadFile(path.join(__dirname, "../build/index.html"));
  }

  // Show window when ready
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // Handle window closed
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Create menu
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

// IPC handlers for macro operations
ipcMain.handle("execute-macro", async (event, macro) => {
  return new Promise((resolve, reject) => {
    const { commands, executionMode, parameters } = macro;
    
    if (executionMode === "concurrent") {
      // Execute all commands concurrently
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
      // Execute commands sequentially
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

// Save macros to file system
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

// Execute single command from renderer
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

function processCommandWithParameters(command, parameters) {
  let processedCommand = command;
  
  // Replace parameter placeholders with actual values
  if (parameters) {
    Object.keys(parameters).forEach(key => {
      const placeholder = `{{${key}}}`;
      processedCommand = processedCommand.replace(new RegExp(placeholder, 'g'), parameters[key]);
    });
  }
  
  return processedCommand;
}

// Function to run macro from command line
async function runMacroFromCLI(macroName, params) {
  try {
    // Load macros from localStorage equivalent
    const userDataPath = app.getPath('userData');
    const macrosPath = path.join(userDataPath, 'macroflow-macros.json');
    
    let macros = [];
    if (fs.existsSync(macrosPath)) {
      const data = fs.readFileSync(macrosPath, 'utf8');
      macros = JSON.parse(data);
    }
    
    // Find the macro by name
    const macro = macros.find(m => m.name === macroName);
    if (!macro) {
      console.error(`❌ Macro "${macroName}" not found`);
      console.log("Available macros:");
      macros.forEach(m => console.log(`  - ${m.name}`));
      app.quit();
      return;
    }
    
    // Prepare parameters
    const parameters = {};
    if (macro.parameters && macro.parameters.length > 0) {
      macro.parameters.forEach((param, index) => {
        parameters[param] = params[index] || "";
      });
    }
    
    console.log(`🚀 Running macro: ${macro.name}`);
    console.log(`📋 Commands: ${macro.commands.length}`);
    console.log(`⚡ Mode: ${macro.executionMode}`);
    
    // Execute the macro
    const results = await executeMacro(macro, parameters);
    
    // Display results
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
    
    // Update last run time
    macro.lastRun = new Date().toISOString();
    fs.writeFileSync(macrosPath, JSON.stringify(macros, null, 2));
    
    console.log("\n✅ Macro execution completed");
    app.quit();
    
  } catch (error) {
    console.error(`❌ Error running macro: ${error.message}`);
    app.quit();
  }
}

// Function to execute macro (extracted from IPC handler)
async function executeMacro(macro, parameters) {
  return new Promise((resolve, reject) => {
    const { commands, executionMode } = macro;
    
    if (executionMode === "concurrent") {
      // Execute all commands concurrently
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
      // Execute commands sequentially
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

// App event handlers
app.whenReady().then(() => {
  // Check if running in CLI mode
  if (command === "run-macro" && macroName) {
    runMacroFromCLI(macroName, macroParams);
  } else {
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
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Handle security warnings
app.on("web-contents-created", (event, contents) => {
  contents.on("new-window", (newEvent, navigationUrl) => {
    newEvent.preventDefault();
    require("electron").shell.openExternal(navigationUrl);
  });
});
