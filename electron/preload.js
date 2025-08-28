const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  executeMacro: (macro) => ipcRenderer.invoke("execute-macro", macro),
  executeCommand: (command) => ipcRenderer.invoke("execute-command", command),
  saveMacros: (macros) => ipcRenderer.invoke("save-macros", macros),
  checkMacroCommand: () => ipcRenderer.invoke("check-macro-command"),
  installMacroflowCommand: () => ipcRenderer.invoke("install-macroflow-command"),
  getVersion: () => ipcRenderer.invoke("get-version"),
  onMenuAction: (callback) => ipcRenderer.on("menu-action", callback),
  removeMenuActionListener: () => ipcRenderer.removeAllListeners("menu-action"),
});
