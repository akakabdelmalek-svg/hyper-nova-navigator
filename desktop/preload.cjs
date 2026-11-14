const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('hyperNovaDesktop', {
  isDesktopApp: true,
  platform: process.platform,
});
