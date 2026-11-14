const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const PRIMARY_URL =
  process.env.HYPER_NOVA_URL || 'https://hyper-nova-navigator.vercel.app';

const CANDIDATE_URLS = Array.from(
  new Set([
    PRIMARY_URL,
    'https://hyper-nova-navigator.vercel.app',
    'https://hyper-nova-navigator-gaming.vercel.app',
  ])
);

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

function buildFallbackHtml(failedUrl) {
  const safeUrl = String(failedUrl || PRIMARY_URL).replace(/[<>"'&]/g, '');
  const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Hyper Nova Navigator</title>
  <style>
    body{margin:0;min-height:100vh;background:#07090E;color:#e2e8f0;font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center}
    .card{max-width:440px;background:#0B101C;border:1px solid #1e293b;border-radius:16px;padding:32px;box-shadow:0 24px 60px rgba(0,0,0,.6)}
    h1{margin:0 0 8px;font-size:20px;color:#67e8f9}
    p{margin:0 0 20px;font-size:13px;line-height:1.5;color:#94a3b8}
    a,button{display:inline-block;padding:10px 20px;border-radius:8px;border:0;background:#06b6d4;color:#04101d;font-weight:700;font-size:13px;cursor:pointer;text-decoration:none}
    a:hover,button:hover{background:#22d3ee}
  </style>
</head>
<body>
  <div class="card">
    <h1>Hyper Nova Navigator</h1>
    <p>Impossible de joindre le serveur Hyper Nova (${safeUrl}). Vérifiez votre connexion Internet puis réessayez.</p>
    <a href="${PRIMARY_URL}">Réessayer la connexion</a>
  </div>
</body>
</html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

function createMainWindow() {
  let candidateIndex = 0;
  let activeUrl = CANDIDATE_URLS[0];

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

  const tryNextCandidate = () => {
    candidateIndex += 1;
    if (candidateIndex < CANDIDATE_URLS.length) {
      activeUrl = CANDIDATE_URLS[candidateIndex];
      mainWindow.loadURL(activeUrl);
      return true;
    }
    return false;
  };

  mainWindow.webContents.session.webRequest.onCompleted(
    { urls: ['https://*.vercel.app/*'], types: ['mainFrame'] },
    (details) => {
      if (details.statusCode >= 400) {
        if (!tryNextCandidate()) {
          mainWindow.loadURL(buildFallbackHtml(details.url));
        }
      }
    }
  );

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, _desc, validatedURL, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) return;
    if (!tryNextCandidate()) {
      mainWindow.loadURL(buildFallbackHtml(validatedURL));
    }
  });

  mainWindow.loadURL(activeUrl);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    let activeOrigin = '';
    try {
      activeOrigin = new URL(activeUrl).origin;
    } catch {
      activeOrigin = PRIMARY_URL;
    }
    if (
      url.startsWith('https://accounts.google.com') ||
      url.includes('firebaseapp.com/__/auth') ||
      url.startsWith(activeOrigin)
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
