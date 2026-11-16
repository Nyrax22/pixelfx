const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  fullscreen: on => ipcRenderer.invoke('fullscreen', on),
  quit: () => ipcRenderer.invoke('quit'),
  achievement: id => ipcRenderer.invoke('ach', id),
  steamName: () => ipcRenderer.invoke('steamName')
});
