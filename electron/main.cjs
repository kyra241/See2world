const { app, BrowserWindow, session, ipcMain, desktopCapturer } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webviewTag: true
    },
    autoHideMenuBar: true
  });

  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  } else {
    const url = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    win.loadURL(url);
  }

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Access-Control-Allow-Origin': ['*']
      }
    });
  });

  ipcMain.on('window-minimize', () => win.minimize());
  ipcMain.on('window-maximize', () => {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.on('window-close', () => win.close());

  ipcMain.handle('get-self-source-id', async (event) => {
    try {
      const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] });
      const win = BrowserWindow.fromWebContents(event.sender);
      const title = win.getTitle();
      
      const selfSource = sources.find(s => 
        s.name === title || 
        s.name.toLowerCase().includes('see2world')
      );
      
      if (selfSource) {
        return selfSource.id;
      }
      
      return sources[0]?.id || null;
    } catch (err) {
      console.error('Error getting self source ID:', err);
      return null;
    }
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
