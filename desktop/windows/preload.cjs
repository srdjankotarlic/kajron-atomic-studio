'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('kajronDesktop', {
  send: message => ipcRenderer.send('kajron-message', message),
  onEvent: listener => {
    const handler = (_event, value) => listener(value);
    ipcRenderer.on('kajron-event', handler);
    return () => ipcRenderer.removeListener('kajron-event', handler);
  }
});
