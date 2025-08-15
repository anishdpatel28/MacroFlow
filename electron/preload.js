const { contextBridge, ipcRenderer } = require("electron");

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
  executeMacro: (macro) => ipcRenderer.invoke("execute-macro", macro),
  executeCommand: (command) => ipcRenderer.invoke("execute-command", command),
  saveMacros: (macros) => ipcRenderer.invoke("save-macros", macros),
  onMenuAction: (callback) => ipcRenderer.on("menu-action", callback),
  removeMenuActionListener: () => ipcRenderer.removeAllListeners("menu-action"),
});
