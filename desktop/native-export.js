// Native messages are handled by the bundled macOS application; no network or server.
const native = (message) => window.webkit.messageHandlers.desktop.postMessage(message);
let exporting = false, cancelled = false;
function progress(value, message) {
  $('encode-progress').value = Math.min(100, Math.max(0, value));
  if (message) $('export-status').textContent = message;
}
function finishNativeExport() {
  exporting = false;
  $('export').disabled = false;
  refreshExportAction();
  $('export-progress').hidden = true;
}
window.desktopEvent = (event) => {
  if (event.type === 'fontsLoaded') { installFontChoices(event); return; }
  if (event.type === 'progress') progress(event.value, event.message);
  if (event.type === 'complete') {
    finishNativeExport();
    $('export-result').hidden = false;
    $('export-result').firstElementChild.textContent = `✓ Sačuvan ${String(event.format || '').toUpperCase()} video · ${(event.bytes / 1048576).toFixed(1)} MB`;
    $('download-again').textContent = window.kajronDesktop ? 'Prikaži u folderu ↗' : 'Prikaži u Finder-u ↗';
    $('download-again').title = event.path;
    $('saved-path').textContent = event.path;
    $('saved-path').hidden = false;
    toast(`Video je sačuvan: ${event.name}`);
  }
  if (event.type === 'cancelled') { finishNativeExport(); toast('Izvoz je otkazan.'); }
  if (event.type === 'failed') { finishNativeExport(); $('saved-path').textContent = event.message; $('saved-path').hidden = false; toast(event.message); }
  if (event.type === 'notice') toast(event.message);
  if (event.type === 'projectLoaded') {
    fontsReady.then(() => fontInstallQueue).then(() => {
    try {
      const parsed = event.project;
      if (!['Kajron Studio', 'Kajron Atomic Studio'].includes(parsed.app) || parsed.version !== 1 || typeof parsed.settings?.text !== 'string') throw new Error();
      noteFontChoice();
      const missingFont = /^AtomicFont_/.test(parsed.settings.font || '') && !enums.font.includes(parsed.settings.font);
      state = sanitize(parsed.settings); playTime = 0; updateUI(true); persist(); refreshExportAction();
      toast(missingFont ? 'Projekat je učitan. Dodaj njegov TTF/OTF font na ovom računaru; privremeno je izabran Arial.' : 'Projekat je učitan.');
    } catch { toast('Izaberi ispravan Kajron Atomic Studio JSON projekat.'); }
    });
  }
};
async function encodeBase64(bytes) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('Priprema slike nije uspela.'));
    reader.readAsDataURL(new Blob([bytes], { type: 'image/png' }));
  });
}
$('export').addEventListener('click', async () => {
  if (exporting) return;
  state = sanitize({ ...state, format: $('format').value });
  const s = { ...state }, g = calc(s);
  if (!g.text) { toast('Prvo unesi tekst kajrona.'); $('tab-content').click(); $('text').focus(); return; }
  exporting = true; cancelled = false;
  refreshExportAction();
  $('export').disabled = true;
  $('export').innerHTML = '<span>◌</span> Video se pravi…';
  $('export-progress').hidden = false;
  $('export-result').hidden = true;
  $('saved-path').hidden = true;
  progress(1, 'Priprema kajrona…');
  try {
    const rendered = await renderLayers(s, g);
    const layers = {};
    for (const key of ['base', 'track', 'fg', 'mask']) layers[key] = await encodeBase64(rendered[key]);
    if (cancelled) { finishNativeExport(); return; }
    progress(3, 'Izaberi gde želiš da sačuvaš video…');
    native({ action: 'export', layers, args: buildCommand(s, g), format: s.format, frames: g.frames, name: `kajron-${g.width}x${rendered.h}-${s.fps}fps.${s.format}` });
  } catch (error) { finishNativeExport(); toast(error.message || 'Izvoz nije uspeo.'); }
});
$('cancel-export').addEventListener('click', () => { cancelled = true; native({ action: 'cancel' }); });
$('download-again').addEventListener('click', e => { e.preventDefault(); native({ action: 'reveal' }); });
$('save-project').addEventListener('click', () => native({ action: 'saveProject', contents: JSON.stringify({ app: 'Kajron Atomic Studio', version: 1, settings: state }, null, 2) }));
$('import-project').addEventListener('click', () => native({ action: 'loadProject' }));
$('add-fonts').addEventListener('click', () => native({ action: 'importFonts' }));
$('font').addEventListener('input', noteFontChoice);
$('fullscreen').addEventListener('click', () => native({ action: 'fullscreen' }));
document.querySelector('.brand').addEventListener('click', e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); });

function refreshExportAction() {
  if (!exporting) $('export').innerHTML = `<span>↓</span> Izvezi ${state.format.toUpperCase()} video <span>↗</span>`;
  for (const ext of ['mp4', 'mov', 'webm']) $('export-' + ext).disabled = exporting || (state.textOnly && ext === 'mp4');
}
for (const ext of ['mp4', 'mov', 'webm']) $('export-' + ext).addEventListener('click', () => {
  if (exporting) return;
  state = sanitize({ ...state, format: ext, transparent: ext !== 'mp4' });
  updateUI(true); persist(); refreshExportAction(); $('export').click();
});
for (const type of ['input', 'change']) $('format').addEventListener(type, () => {
  state = sanitize({ ...state, format: $('format').value, transparent: $('format').value !== 'mp4' });
  updateUI(); persist(); refreshExportAction();
  if (!exporting) { $('export-result').hidden = true; $('saved-path').hidden = true; }
});
document.addEventListener('input', () => { if (!exporting) refreshExportAction(); });
$('reset').addEventListener('click', refreshExportAction);
updateUI(true); refreshExportAction(); requestAnimationFrame(tick);
native({ action: 'loadFonts' });
