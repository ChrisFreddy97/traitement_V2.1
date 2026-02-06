const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  readFolder: (folderPath) => ipcRenderer.invoke('read-folder', folderPath),
  saveFolder: (folderData) => ipcRenderer.invoke('save-folder', folderData),
  
  // API pour upload de dossier
  uploadFolderStructure: (folderPath) => ipcRenderer.invoke('upload-folder-structure', folderPath),
  uploadFolder: (folderData) => ipcRenderer.invoke('upload-folder', folderData),
  readFileContent: (filePath) => ipcRenderer.invoke('read-file-content', filePath),
  
  // NOUVELLES FONCTIONS AJOUTÉES
  getFileDate: (filePath) => ipcRenderer.invoke('get-file-date', filePath),
  getFileSize: (filePath) => ipcRenderer.invoke('get-file-size', filePath),
  uploadSelectedFiles: (folderData) => ipcRenderer.invoke('upload-selected-files', folderData)
});