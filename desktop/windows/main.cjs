'use strict';
const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');
const { randomUUID, createHash } = require('node:crypto');
const { validateExport, renderExport } = require('./exporter.cjs');

const translations = require('./translations.json');
let language = 'en';
const L = text => language === 'en' ? (translations[text] || text) : text;
const indexPath = path.join(__dirname, 'ui', 'index.html');
let win, control = null, completedPath = null, exiting = false;
const send = value => { if (win && !win.isDestroyed()) win.webContents.send('kajron-event', value); };
const trigger = id => { if (win && !win.isDestroyed()) win.webContents.executeJavaScript(`document.getElementById(${JSON.stringify(id)}).click()`); };

async function exportVideo(message) {
  if (control) return;
  const current = { cancelled: false, process: null };
  control = current;
  try {
    validateExport(message);
    const ext = message.format;
    const picked = await dialog.showSaveDialog(win, {
      title: L('Izvezi kajron kao video'),
      defaultPath: path.join(app.getPath('desktop'), path.basename(message.name || `kajron.${ext}`)),
      filters: [{ name: `${ext.toUpperCase()} video`, extensions: [ext] }],
      properties: ['showOverwriteConfirmation', 'createDirectory']
    });
    if (picked.canceled || !picked.filePath || current.cancelled) { send({ type: 'cancelled' }); return; }
    let target = picked.filePath;
    if (path.extname(target).toLowerCase() !== `.${ext}`) target += `.${ext}`;
    const result = await renderExport(path.join(__dirname, 'bin', 'ffmpeg.exe'), message, target, current,
      (value, label) => send({ type: 'progress', value, message: label }));
    if (!result) { send({ type: 'cancelled' }); return; }
    completedPath = target;
    send(result);
  } catch (error) {
    if (current.cancelled) send({ type: 'cancelled' });
    else {
      if (error.encoderLog) await fs.writeFile(path.join(app.getPath('userData'), 'last-export.log'), error.encoderLog).catch(() => {});
      send({ type: 'failed', message: error.message || L('Izvoz nije uspeo.') });
    }
  } finally { if (control === current) control = null; }
}
async function saveProject(message) {
  if (typeof message.contents !== 'string' || Buffer.byteLength(message.contents) > 50000) return;
  const result = await dialog.showSaveDialog(win, { title: L('Sačuvaj projekat'), defaultPath: path.join(app.getPath('desktop'), 'kajron-projekat.json'), filters: [{ name: L('Kajron Atomic Studio projekat'), extensions: ['json'] }] });
  if (result.canceled || !result.filePath) return;
  const staging = `${result.filePath}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(staging, message.contents, 'utf8');
    await fs.rename(staging, result.filePath);
    send({ type: 'notice', message: L('Projekat je sačuvan.') });
  } finally { await fs.rm(staging, { force: true }).catch(() => {}); }
}
async function loadProject() {
  const picked = await dialog.showOpenDialog(win, { title: L('Otvori projekat'), filters: [{ name: L('Kajron Atomic Studio projekat'), extensions: ['json'] }], properties: ['openFile'] });
  if (picked.canceled || !picked.filePaths[0]) return;
  if ((await fs.stat(picked.filePaths[0])).size > 50000) throw new Error(L('Projekat je prevelik.'));
  send({ type: 'projectLoaded', project: JSON.parse(await fs.readFile(picked.filePaths[0], 'utf8')) });
}
async function readFonts() {
  const folder = path.join(app.getPath('userData'), 'fonts');
  const filenames = (await fs.readdir(folder).catch(() => [])).filter(name => /^[a-f0-9]{64}\.json$/.test(name)).slice(0,32);
  const result = [];
  for (const filename of filenames) {
    try {
      const item = JSON.parse(await fs.readFile(path.join(folder,filename),'utf8'));
      if (!/^[a-f0-9]{64}\.(ttf|otf|woff|woff2)$/.test(item.file)) continue;
      const binary = await fs.readFile(path.join(folder,item.file));
      if (binary.length>10000000) continue;
      result.push({ family:item.family,label:item.label,data:binary.toString('base64') });
    } catch {}
  }
  return result;
}
function validFontHeader(data) {
  return data.length >= 12 && ['00010000','4f54544f','74727565','774f4646','774f4632'].includes(data.subarray(0,4).toString('hex'));
}
async function importFonts() {
  const picked = await dialog.showOpenDialog(win, { title: L('Dodaj fontove u Kajron Atomic Studio'), filters: [{ name: L('Fontovi (TTF / OTF / WOFF / WOFF2)'), extensions: ['ttf','otf','woff','woff2'] }], properties: ['openFile','multiSelections'] });
  if (picked.canceled) return;
  const folder = path.join(app.getPath('userData'),'fonts');
  await fs.mkdir(folder,{recursive:true});
  let selectedFamily = null;
  let library = await readFonts();
  let total = library.reduce((sum,font) => sum + Buffer.byteLength(font.data,'base64'),0);
  const warnings = [];
  for (const file of picked.filePaths) {
    try {
      const ext = path.extname(file).slice(1).toLowerCase();
      if (!['ttf','otf','woff','woff2'].includes(ext)) throw new Error(L('Izaberi ispravan font.'));
      if ((await fs.stat(file)).size > 10000000) throw new Error(L('Font je prevelik. Najveća veličina fonta je 10 MB.'));
      const data = await fs.readFile(file);
      if (!validFontHeader(data)) throw new Error(L('Izaberi ispravan font.'));
      const hash = createHash('sha256').update(data).digest('hex');
      let filename = hash + '.' + ext;
      const previous = await fs.readFile(path.join(folder,hash+'.json'),'utf8').then(JSON.parse).catch(() => null);
      if (previous && typeof previous.file === 'string' && previous.file.startsWith(hash+'.') && /^[a-f0-9]{64}\.(ttf|otf|woff|woff2)$/.test(previous.file)) filename = previous.file;
      if (!(await fs.access(path.join(folder,filename)).then(() => true,() => false))) {
        if (library.length >= 32 || total + data.length > 40000000) throw new Error(L('Biblioteka fontova je puna (32 fonta / 40 MB).'));
        await fs.writeFile(path.join(folder,filename),data);
        total += data.length;
      }
      const item = { family: 'AtomicFont_'+hash, label: path.basename(file,path.extname(file)), file: filename };
      await fs.writeFile(path.join(folder,hash+'.json'),JSON.stringify(item),'utf8');
      selectedFamily = item.family;
      library = await readFonts();
    } catch (error) { warnings.push(path.basename(file) + ': ' + error.message); }
  }
  send({ type: 'fontsLoaded', fonts: library, selectedFamily, warning: warnings.slice(0,3).join(' · ') });
}
function createWindow() {
  win = new BrowserWindow({
    width: 1340, height: 1000, minWidth: 960, minHeight: 700, title: 'Kajron Atomic Studio',
    backgroundColor: '#111315', icon: path.join(__dirname, 'icon.ico'), show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true }
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  win.loadFile(indexPath);
  win.once('ready-to-show', () => win.show());
  win.on('close', event => {
    if (control && !exiting) {
      const choice = dialog.showMessageBoxSync(win, { type: 'question', message: L('Izvoz videa je u toku.'), detail: L('Zatvaranje aplikacije će otkazati tekući izvoz.'), buttons: [L('Nastavi izvoz'), L('Otkaži i zatvori')], defaultId: 0, cancelId: 0 });
      if (choice === 0) { event.preventDefault(); return; }
      control.cancelled = true; control.process?.kill();
    }
  });
  setupMenu();
}
function setupMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: L('Datoteka'), submenu: [
      { label: L('Sačuvaj projekat…'), accelerator: 'CmdOrCtrl+S', click: () => trigger('save-project') },
      { label: L('Otvori projekat…'), accelerator: 'CmdOrCtrl+O', click: () => trigger('import-project') },
      { type: 'separator' },
      { label: L('Izvezi video…'), accelerator: 'CmdOrCtrl+E', click: () => trigger('export') },
      { label: L('Prikaži poslednji video'), click: () => { if (completedPath) shell.showItemInFolder(completedPath); } },
      { type: 'separator' }, { role: 'quit', label: L('Zatvori Kajron Atomic Studio') }
    ] },
    { label: L('Uređivanje'), submenu: [{ role: 'undo', label: L('Poništi') }, { role: 'redo', label: L('Ponovi') }, { type: 'separator' }, { role: 'cut', label: L('Iseci') }, { role: 'copy', label: L('Kopiraj') }, { role: 'paste', label: L('Nalepi') }, { role: 'selectAll', label: L('Izaberi sve') }] },
    { label: L('Prikaz'), submenu: [{ role: 'resetZoom', label: L('Stvarna veličina') }, { role: 'zoomIn', label: L('Uvećaj') }, { role: 'zoomOut', label: L('Umanji') }, { role: 'togglefullscreen', label: L('Ceo ekran') }] },
    { label: L('Pomoć'), submenu: [{ label: L('Kako ubaciti kajron u OBS'), click: () => trigger('guide-open') }, { label: L('O aplikaciji'), click: () => dialog.showMessageBox(win, { message: 'Kajron Atomic Studio ' + app.getVersion(), detail: L('Lokalni generator video-kajrona za OBS. Svi resursi i video-pogon uključeni su u instalaciju. Internet nije potreban.') }) }] }
  ]));
}
ipcMain.on('kajron-message', (event, message) => {
  if (!win || event.sender !== win.webContents || event.senderFrame?.url !== pathToFileURL(indexPath).href || !message || typeof message.action !== 'string') return;
  Promise.resolve().then(async () => {
    switch (message.action) {
      case 'setLanguage': language = message.language === 'sr' ? 'sr' : 'en'; setupMenu(); break;
      case 'export': await exportVideo(message); break;
      case 'cancel': if (control) { control.cancelled = true; control.process?.kill(); } break;
      case 'reveal': if (completedPath) shell.showItemInFolder(completedPath); break;
      case 'saveProject': await saveProject(message); break;
      case 'loadProject': await loadProject(); break;
      case 'loadFonts': send({type:'fontsLoaded',fonts:await readFonts()}); break;
      case 'importFonts': await importFonts(); break;
      case 'fullscreen': win.setFullScreen(!win.isFullScreen()); break;
    }
  }).catch(error => send({ type: 'notice', message: error.message || L('Operacija nije uspela.') }));
});
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
  app.whenReady().then(createWindow);
  app.on('window-all-closed', () => app.quit());
}
