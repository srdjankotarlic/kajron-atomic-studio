const importedFonts = new Map();
let fontLibraryLoaded = false;
let pendingCustomFont = null;
let fontChoiceVersion = 0;
let fontInstallQueue = Promise.resolve();
let resolveFontsReady;
const fontsReady = new Promise(resolve => { resolveFontsReady = resolve; });
function noteFontChoice() { fontChoiceVersion++; }
function settingsForStorage(settings) {
  // Keep the saved custom font identifier while its FontFace is still loading.
  return !fontLibraryLoaded && fontChoiceVersion === 0 && /^AtomicFont_[a-f0-9]{64}$/.test(pendingCustomFont || '') ? { ...settings, font: pendingCustomFont } : settings;
}
try { pendingCustomFont = JSON.parse(localStorage.getItem('kajron-studio-project-v1'))?.font || null; } catch {}
function installFontChoices(event) {
  const version = fontChoiceVersion;
  const task = fontInstallQueue.then(() => applyFontChoices(event, version));
  fontInstallQueue = task.catch(() => toast('Neki fontovi nisu učitani. Probaj drugi TTF ili OTF fajl.'));
  return task;
}
async function applyFontChoices(event, version) {
  let failures = 0;
  for (const asset of event.fonts || []) {
    if (!/^AtomicFont_[a-f0-9]{64}$/.test(asset.family) || importedFonts.has(asset.family)) continue;
    try {
      const binary = atob(asset.data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const face = new FontFace(asset.family, bytes.buffer);
      await face.load();
      document.fonts.add(face);
      importedFonts.set(asset.family, { family: asset.family, label: asset.label });
      enums.font.push(asset.family);
      const option = document.createElement('option');
      option.value = asset.family; option.textContent = asset.label + ' · Tvoj font';
      $('font').append(option);
    } catch { failures++; }
  }
  const unchanged = version === fontChoiceVersion;
  const wanted = (unchanged && event.selectedFamily) || (!fontLibraryLoaded && fontChoiceVersion === 0 && unchanged && importedFonts.has(pendingCustomFont) ? pendingCustomFont : state.font);
  if (enums.font.includes(wanted) && state.font !== wanted) { state.font = wanted; state.preset = 'custom'; }
  fontLibraryLoaded = true; pendingCustomFont = null;
  resolveFontsReady();
  $('font').value = state.font;
  updateUI(); persist(); refreshExportAction();
  $('font-library-count').textContent = `${importedFonts.size} dodatih fontova · TTF / OTF / WOFF / WOFF2`;
  if (event.warning) toast(event.warning);
  else if (failures) toast('Neki fontovi nisu učitani. Probaj drugi TTF ili OTF fajl.');
  else if (event.selectedFamily) toast('Font je dodat i spreman za kajron.');
}
