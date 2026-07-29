/* 現場経路作成アプリ（パソコン用）の入れ物

   ブラウザ版の index.html を、そのまま窓に表示します。
   index.html は書き換えていません。パソコン用だけの機能（アプリの中に地図を開いて
   範囲を切り取る）は preload.js が後から足しています。
   ブラウザ版はこれまでどおり、index.html をダブルクリックするだけで動きます。 */
'use strict';
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

const APP_HTML = path.join(__dirname, '..', 'index.html');
const APP_ICON = path.join(__dirname, '..', 'icon-512.png');

function createWindow() {
  const win = new BrowserWindow({
    width: 1500,
    height: 950,
    minWidth: 900,
    minHeight: 600,
    title: '現場経路作成アプリ',
    icon: APP_ICON,
    backgroundColor: '#4a4f57',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true,        // アプリの中に地図の画面を出すために必要です
      contextIsolation: false, // preload から画面を直接組み立てるため
      nodeIntegration: false,  // 表示している中身に Node は渡しません
      spellcheck: false
    }
  });

  win.setMenuBarVisibility(false);          // 「ファイル」などの帯は出しません
  win.once('ready-to-show', () => win.show());
  win.loadFile(APP_HTML);

  // 地図の中のリンクで別窓を開こうとしたら、既定のブラウザに任せます
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  return win;
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
