const importedFonts = new Map();
let fontLibraryLoaded = false;
let pendingCustomFont = null;
try { pendingCustomFont = JSON.parse(localStorage.getItem('kajron-studio-project-v1'))?.font || null; } catch {}
async function installFontChoices(event) {
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
  const wanted = event.selectedFamily || (!fontLibraryLoaded && importedFonts.has(pendingCustomFont) ? pendingCustomFont : state.font);
  if (enums.font.includes(wanted)) state.font = wanted;
  fontLibraryLoaded = true; pendingCustomFont = null;
  updateUI(true); persist(); refreshExportAction();
  $('font-library-count').textContent = `${importedFonts.size} dodatih fontova · TTF / OTF / WOFF / WOFF2`;
  if (failures) toast('Neki fontovi nisu učitani. Probaj drugi TTF ili OTF fajl.');
  else if (event.selectedFamily) toast('Font je dodat i spreman za kajron.');
}
