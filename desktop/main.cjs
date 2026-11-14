const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const APP_URL =
  process.env.HYPER_NOVA_URL || 'https://hyper-nova-navigator-gaming.vercel.app';

function resolveIconPath() {
  const candidates = [
    path.join(process.resourcesPath || '', 'icon.png'),
    path.join(__dirname, '../public/pwa-512x512.png'),
  ];
  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p;
  }
  return undefined;
}

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1380,
    height: 860,
    minWidth: 380,
    minHeight: 600,
    title: 'Hyper Nova Navigator',
    backgroundColor: '#07090E',
    icon: resolveIconPath(),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
    },
  });

  Menu.setApplicationMenu(null);

  mainWindow.loadURL(APP_URL);

  // Open OAuth popups (Firebase Google Sign-In) in clean child windows, external links in OS handler or app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (
      url.startsWith('https://accounts.google.com') ||
      url.includes('firebaseapp.com/__/auth') ||
      url.startsWith(APP_URL)
    ) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 520,
          height: 680,
          backgroundColor: '#07090E',
          autoHideMenuBar: true,
        },
      };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
