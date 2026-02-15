const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  storeViaHttp: (data) => ipcRenderer.invoke('storeViaHttp', data),
  getAllFiles: () => ipcRenderer.invoke('getAllFiles'),
  deleteFile: (fileId) => ipcRenderer.invoke('deleteFile', fileId),
  downloadFile: (objectKey) => ipcRenderer.invoke('downloadFile', objectKey),
  downloadToNeutralBase: (objectKey) => ipcRenderer.invoke('downloadToNeutralBase', objectKey),
  generateTestFile: () => ipcRenderer.invoke('generateTestFile'),
  getCloudStorageStatus: () => ipcRenderer.invoke('getCloudStorageStatus')
});
