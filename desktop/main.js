/* 現場経路作成アプリ（パソコン用）の入れ物

   ブラウザ版の index.html を、そのまま窓に表示します。
   index.html は書き換えていません。パソコン用だけの機能（アプリの中に地図を開いて
   範囲を切り取る）は preload.js が後から足しています。
   ブラウザ版はこれまでどおり、index.html をダブルクリックするだけで動きます。 */
'use strict';
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

/* アプリ本体（index.html）の置き場所。
   exe に包んだときは resources\app の中に、
   ふだん（npm start）は、ひとつ上のフォルダにあります */
const BASE = app.isPackaged ? path.join(process.resourcesPath, 'app')
                            : path.join(__dirname, '..');
const APP_HTML = path.join(BASE, 'index.html');
const APP_ICON = path.join(BASE, 'icon-512.png');

/* 窓が他の窓の後ろに隠れていると、地図の絵を描くのを止めてしまい、
   切り取ったときに真っ白になることがあります。それを止めない設定です */
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

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
      backgroundThrottling: false, // 隠れていても描き続けます（切り取り対策）
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
