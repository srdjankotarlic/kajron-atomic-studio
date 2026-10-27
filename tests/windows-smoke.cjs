// Run in a disposable Electron app directory, using the real packaged runtime.
// See docs/BUILD.md. Does not modify the installed user's application data.
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { renderExport } = require('./exporter.cjs');
const reportPath = process.env.KAJRON_SMOKE_REPORT || path.join(os.tmpdir(), 'kajron-windows-smoke.json');
let window, waiting;
const report = { platform: process.platform, electron: process.versions.electron, exports: [] };
let timer;
async function finish(error) {
  clearTimeout(timer);
  if (error) report.error = error.stack || String(error);
  report.pass = !error;
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  app.exit(error ? 1 : 0);
}
app.setPath('userData', path.join(os.tmpdir(), 'kajron-smoke-' + process.pid));
ipcMain.on('kajron-message', async (_event, message) => {
  if (message.action === 'loadGraphics') window.webContents.send('kajron-event', { type: 'graphicsLoaded', assets: [] });
  if (message.action === 'loadFonts') window.webContents.send('kajron-event', { type: 'fontsLoaded', fonts: [] });
  if (message.action !== 'export') return;
  try {
    const target = path.join(path.dirname(reportPath), `smoke-${message.format}.${message.format}`);
    const result = await renderExport(path.join(__dirname, 'bin', 'ffmpeg.exe'), message, target, { cancelled: false });
    const bytes = await fs.readFile(target);
    assert.ok(bytes.length > 1000);
    if (message.format === 'webm') assert.equal(bytes.subarray(0,4).toString('hex'), '1a45dfa3');
    else assert.equal(bytes.subarray(4,8).toString('ascii'), 'ftyp');
    report.exports.push({ format: message.format, bytes: bytes.length });
    window.webContents.send('kajron-event', result);
    waiting.resolve();
  } catch (error) { waiting.reject(error); }
});
app.whenReady().then(async () => {
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  timer = setTimeout(() => finish(new Error('Smoke test timed out')), 120000);
  window = new BrowserWindow({ show: false, width: 1340, height: 950, webPreferences: { preload: path.join(__dirname,'preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false, offscreen: true } });
  await window.loadFile(path.join(__dirname,'ui','index.html'));
  const evaluate = code => window.webContents.executeJavaScript(code);
  assert.equal(await evaluate("window.KajronI18n.language"), 'en');
  const text = await evaluate("document.getElementById('text').value");
  await evaluate("window.KajronI18n.select('sr')");
  assert.match(await evaluate("document.getElementById('save-project').textContent"), /Sačuvaj projekat/);
  assert.equal(await evaluate("document.getElementById('text').value"), text);
  await evaluate("window.KajronI18n.select('en')");
  assert.match(await evaluate("document.getElementById('save-project').textContent"), /Save project/);
  const font = await fs.readFile(path.join(process.env.WINDIR || 'C:\\Windows','Fonts','arial.ttf'));
  const family = 'AtomicFont_' + createHash('sha256').update(font).digest('hex');
  await evaluate(`installFontChoices(${JSON.stringify({ fonts: [{ family, label:'Smoke font', data:font.toString('base64') }], selectedFamily:family })})`);
  assert.equal(await evaluate("state.font"), family);
  assert.equal(await evaluate(`document.fonts.check('40px "${family}"')`), true);
  report.fontImport = true;
  for (const format of ['mp4','webm','mov']) {
    const pending = new Promise((resolve,reject) => { waiting = { resolve,reject }; });
    await evaluate(`state=sanitize({...state,text:'OBS Atomic Studio ČĆŽŠĐ',labelEnabled:false,fontSize:32,motion:'static',staticDuration:5,resolution:'custom',customWidth:640,customHeight:360,scope:'strip',fps:25,format:${JSON.stringify(format)},transparent:${format!=='mp4'},textOnly:${format!=='mp4'}});updateUI(true);document.getElementById('export').click()`);
    await pending;
    await evaluate("(async()=>{for(let i=0;i<100;i++){if(!exporting)return;await new Promise(r=>setTimeout(r,50));}throw new Error('Renderer did not finish export');})()");
  }
  report.languageSwitch = true;
  await finish();
}).catch(finish);
