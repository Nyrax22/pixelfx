// Desktop shell for Steam. Loads the bundled game from ./app (offline), starts fullscreen,
// and bridges achievements / quit to the page through preload.js.
const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron');
const path = require('path');

let steam = null;
try {
  const sw = require('steamworks.js');
  steam = sw.init(); // reads steam_appid.txt next to the executable during development
  sw.electronEnableSteamOverlay();
} catch (e) {
  steam = null; // runs fine without Steam (itch.io, testing)
}

let win;
function create() {
  Menu.setApplicationMenu(null);
  win = new BrowserWindow({
    width: 1600, height: 900, minWidth: 1024, minHeight: 600,
    fullscreen: true, backgroundColor: '#121110', show: false,
    title: '인생 떡상',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: false, backgroundThrottling: false }
  });
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && (input.key === 'F11' || (input.alt && input.key === 'Enter'))) {
      win.setFullScreen(!win.isFullScreen()); e.preventDefault();
    }
  });
}

ipcMain.handle('fullscreen', (_e, on) => { if (win) win.setFullScreen(on == null ? !win.isFullScreen() : !!on); return win ? win.isFullScreen() : false; });
ipcMain.handle('quit', () => app.quit());
ipcMain.handle('ach', (_e, id) => {
  if (!steam) return false;
  try { return steam.achievement.activate(String(id).toUpperCase()); } catch (e) { return false; }
});
ipcMain.handle('steamName', () => { try { return steam ? steam.localplayer.getName() : null; } catch (e) { return null; } });

app.whenReady().then(create);
app.on('window-all-closed', () => app.quit());
