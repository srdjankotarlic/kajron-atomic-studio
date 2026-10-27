
const $ = (id) => document.getElementById(id);
const defaults = {
  text: 'Dobrodošli u prenos uživo!\nSve najnovije informacije na jednom mestu.\nOstanite uz nas.',
  labelEnabled: true, label: 'UŽIVO', labelUppercase: true, labelShape: 'rectangle', barStyle: 'solid', graphics: [], textX: 0, textY: 0, textWidth: 100, textHeight: 100, font: 'Arial', fontSize: 40, bold: true, uppercase: false,
  barHeight: 100, textColor: '#ffffff', barColor: '#182020', accentColor: '#cbf77d', labelColor: '#121416',
  opacity: 100, radius: 0, accentLine: true, position: 'bottom', margin: 48, motion: 'left', speed: 120, gap: 120,
  staticDuration: 5, resolution: '1920x1080', customWidth: 1920, customHeight: 1080,
  fps: 30, scope: 'strip', format: 'webm', transparent: true, preset: 'studio'
};
const bindings = {
  text: 'text', labelEnabled: 'label-enabled', label: 'label', font: 'font', fontSize: 'font-size', labelUppercase: 'label-uppercase', labelShape: 'label-shape', barStyle: 'bar-style', textX: 'text-x', textY: 'text-y', textWidth: 'text-width', textHeight: 'text-height',
  bold: 'bold', uppercase: 'uppercase', barHeight: 'bar-height', textColor: 'text-color', barColor: 'bar-color',
  accentColor: 'accent-color', labelColor: 'label-color', opacity: 'opacity', radius: 'radius', position: 'position',
  accentLine: 'accent-line', margin: 'margin', motion: 'motion', speed: 'speed', gap: 'gap', staticDuration: 'static-duration',
  resolution: 'resolution', customWidth: 'custom-width', customHeight: 'custom-height', fps: 'fps',
  scope: 'scope', format: 'format', transparent: 'transparent'
};
const limits = { textX: [0,90], textY: [0,80], textWidth: [10,100], textHeight: [20,100], fontSize: [16, 120], barHeight: [48, 320], opacity: [0, 100], radius: [0, 48], margin: [0, 200], speed: [30, 350], gap: [40, 500], customWidth: [320, 3840], customHeight: [320, 2160] };
const enums = { labelShape: ['rectangle','pill','flag','dot','outline'], barStyle: ['solid','gradient','outline','double','diagonal'], font: ['Arial', 'Verdana', 'Georgia', 'Courier New'], position: ['bottom', 'center', 'top'], motion: ['left', 'right', 'static'], resolution: ['1920x1080', '1280x720', '2560x1440', '3840x2160', 'custom'], fps: [25, 30, 50, 60], scope: ['strip', 'frame'], format: ['webm', 'mov', 'mp4'], staticDuration: [5, 10, 15, 30], preset: [...STUDIO_DESIGNS.map(a=>a.id), 'custom'] };
function sanitize(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Neispravan projekat.');
  const clean = { ...defaults };
  for (const [key, fallback] of Object.entries(defaults)) {
    const value = input[key];
    if (value === undefined) continue;
    if (key === 'graphics') { clean.graphics = sanitizeGraphicLayers(value); continue; }
    if (enums[key]) { if (enums[key].includes(value)) clean[key] = value; }
    else if (limits[key]) { const n = Number(value); if (Number.isFinite(n)) clean[key] = Math.round(Math.min(limits[key][1], Math.max(limits[key][0], n))); }
    else if (key.endsWith('Color')) { if (/^#[0-9a-f]{6}$/i.test(value)) clean[key] = value; }
    else if (typeof fallback === 'boolean') { if (typeof value === 'boolean') clean[key] = value; }
    else if (typeof value === 'string') clean[key] = value.slice(0, key === 'text' ? 1500 : 24);
  }
  clean.barHeight += clean.barHeight % 2;
  clean.customWidth += clean.customWidth % 2;
  clean.customHeight += clean.customHeight % 2;
  if (clean.format === 'mp4') clean.transparent = false;
  return clean;
}
let state;
try { state = sanitize(JSON.parse(localStorage.getItem('kajron-studio-project-v1')) || defaults); } catch { state = { ...defaults }; }
let toastTimer;
function toast(message) { $('toast').textContent = message; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 5000); }
// Persist the small project immediately so a quick close cannot drop the last edit.
function persist() { try { localStorage.setItem('kajron-studio-project-v1', JSON.stringify(settingsForStorage(state))); } catch { toast('Pregledač ne dozvoljava čuvanje. Koristi „Sačuvaj projekat”.'); } }

const preview = $('preview'), ctx = preview.getContext('2d');
const measure = document.createElement('canvas').getContext('2d');
let geometry;
function textOf(s) { const text = s.text.trim().split(/\r?\n/).map(t => t.trim()).filter(Boolean).join('   •   '); return s.uppercase ? text.toLocaleUpperCase('sr-Latn') : text; }
function labelOf(s) { return s.labelUppercase ? s.label.toLocaleUpperCase('sr-Latn') : s.label; }
function textFont(s) { return `${s.bold ? 700 : 400} ${s.fontSize}px "${s.font}"`; }
function calc(s) {
  let [width, height] = s.resolution === 'custom' ? [s.customWidth, s.customHeight] : s.resolution.split('x').map(Number);
  const barHeight = Math.min(s.barHeight, height), barY = s.position === 'top' ? Math.min(s.margin, height - barHeight) : s.position === 'center' ? Math.floor((height - barHeight) / 2) : Math.max(0, height - barHeight - s.margin);
  const labelSize = Math.min(s.fontSize * .72, barHeight * .46);
  measure.font = `700 ${labelSize}px "${s.font}"`;
  const labelWidth = s.labelEnabled && s.label.trim() ? Math.min(Math.ceil(measure.measureText(labelOf(s)).width + s.fontSize * (s.labelShape === 'dot' ? 2.1 : 1.4)), Math.floor(width * .42)) : 0;
  measure.font = textFont(s);
  const text = textOf(s), textWidth = measure.measureText(text).width;
  const period = Math.max(2, Math.ceil((textWidth + s.gap) / 2) * 2);
  const frames = s.motion === 'static' ? Math.round(s.staticDuration * s.fps) : Math.max(1, Math.ceil(period / s.speed * s.fps));
  const contentX = Math.max(labelWidth, Math.floor(width * s.textX / 100));
  const contentY = Math.floor(barHeight * s.textY / 100);
  const contentWidth = Math.max(2, Math.min(width - contentX, Math.floor(width * s.textWidth / 100)));
  const contentHeight = Math.max(2, Math.min(barHeight - contentY, Math.floor(barHeight * s.textHeight / 100)));
  return { width, height, barHeight, barY, labelSize, labelWidth, text, textWidth, period, frames, duration: frames / s.fps, effectiveSpeed: period / (frames / s.fps), contentWidth, contentHeight, contentX, contentY };
}
function roundedPath(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, Math.min(r, h / 2, w / 2)); }
function paintBase(c, s, g, strip = false, opaque = false) {
  const y = strip ? 0 : g.barY, outH = strip ? g.barHeight : g.height;
  if (opaque) { c.fillStyle = '#000000'; c.fillRect(0, 0, g.width, outH); }
  c.save(); roundedPath(c, 0, y, g.width, g.barHeight, s.radius); c.clip();
  c.globalAlpha = s.opacity / 100;
  if(s.barStyle === 'gradient') { const gradient=c.createLinearGradient(0,y,g.width,y+g.barHeight);gradient.addColorStop(0,s.barColor);gradient.addColorStop(1,s.accentColor);c.fillStyle=gradient; }
  else c.fillStyle = s.barColor;
  c.fillRect(0, y, g.width, g.barHeight); c.globalAlpha = 1;
  c.fillStyle=s.accentColor;
  if (s.accentLine) c.fillRect(0, y, g.width, 3);
  if(s.barStyle==='outline'){c.strokeStyle=s.accentColor;c.lineWidth=4;roundedPath(c,2,y+2,g.width-4,g.barHeight-4,Math.max(0,s.radius-2));c.stroke();}
  if(s.barStyle==='double'){c.fillRect(0,y,g.width,4);c.fillRect(0,y+g.barHeight-4,g.width,4);}
  if(s.barStyle==='diagonal'){c.globalAlpha=.16;for(let x=0;x<g.width;x+=80){c.beginPath();c.moveTo(x,y);c.lineTo(x+30,y);c.lineTo(x-20,y+g.barHeight);c.lineTo(x-50,y+g.barHeight);c.fill();}}
  c.restore();
  paintGraphics(c,s,g,'behind',strip);
}
function paintForeground(c, s, g, strip = false) {
  const y = strip ? 0 : g.barY;
  if(g.labelWidth){
    c.save(); roundedPath(c, 0, y, g.width, g.barHeight, s.radius); c.clip();
    const inset=['pill','outline'].includes(s.labelShape)?8:0;
    c.fillStyle=s.accentColor;
    if(s.labelShape==='flag'){c.beginPath();c.moveTo(0,y);c.lineTo(g.labelWidth-14,y);c.lineTo(g.labelWidth,y+g.barHeight/2);c.lineTo(g.labelWidth-14,y+g.barHeight);c.lineTo(0,y+g.barHeight);c.closePath();c.fill();}
    else if(s.labelShape==='outline'){c.strokeStyle=s.accentColor;c.lineWidth=2;roundedPath(c,inset,y+inset,g.labelWidth-inset*2,g.barHeight-inset*2,10);c.stroke();}
    else{roundedPath(c,inset,y+inset,g.labelWidth-inset*2,g.barHeight-inset*2,s.labelShape==='pill'?g.barHeight/2:0);c.fill();}
    const dot=s.labelShape==='dot'?g.labelSize*.65:0;
    if(dot){c.fillStyle=s.labelColor;c.beginPath();c.arc(18+dot/2,y+g.barHeight/2,dot/2,0,Math.PI*2);c.fill();}
    c.fillStyle = s.labelShape==='outline'?s.accentColor:s.labelColor; c.font = `700 ${g.labelSize}px "${s.font}"`; c.textBaseline = 'middle'; c.textAlign = 'center';
    c.fillText(labelOf(s), (g.labelWidth+dot)/2, y+g.barHeight/2+g.labelSize*.04, Math.max(2,g.labelWidth-24-dot)); c.restore();
  }
  paintGraphics(c,s,g,'above',strip);
}
function paintText(c, s, g, time, strip = false) {
  if (!g.text) return;
  const y = strip ? 0 : g.barY;
  let offset = (time % g.duration) / g.duration * g.period;
  if (s.motion === 'right') offset = (g.period - offset) % g.period;
  if (s.motion === 'static') offset = 0;
  c.save(); roundedPath(c, 0, y, g.width, g.barHeight, s.radius); c.clip(); c.beginPath(); c.rect(g.contentX, y + g.contentY, g.contentWidth, g.contentHeight); c.clip();
  c.font = textFont(s); c.fillStyle = s.textColor; c.textBaseline = 'middle'; c.textAlign = 'left';
  if (s.motion === 'static') c.fillText(g.text, g.contentX + 30, y + g.contentY + g.contentHeight / 2 + s.fontSize * .04);
  else for (let x = g.contentX + 30 - offset; x < g.width; x += g.period) c.fillText(g.text, x, y + g.contentY + g.contentHeight / 2 + s.fontSize * .04);
  c.restore();
}
function paintPreview(time) { ctx.clearRect(0, 0, geometry.width, geometry.height); paintBase(ctx, state, geometry); paintText(ctx, state, geometry, time); paintForeground(ctx, state, geometry); paintGraphicSelection(ctx,state,geometry); }
const formatTime = (n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
let playTime = 0, playing = !matchMedia('(prefers-reduced-motion: reduce)').matches, lastTime = performance.now();
function updateUI(syncInputs = false) {
  geometry = calc(state);
  if (syncInputs) for (const [key, id] of Object.entries(bindings)) { const el = $(id); if (el.type === 'checkbox') el.checked = state[key]; else el.value = state[key]; }
  for (const [id, value, unit] of [['font-size', state.fontSize, 'px'], ['bar-height', state.barHeight, 'px'], ['opacity', state.opacity, '%'], ['radius', state.radius, 'px'], ['margin', state.margin, 'px'], ['speed', state.speed, 'px/s'], ['gap', state.gap, 'px']]) $(id + '-value').innerHTML = `${value} <span>${unit}</span>`;
  for (const id of ['text-color', 'bar-color', 'accent-color', 'label-color']) $(id + '-value').textContent = $(id).value.toUpperCase();
  $('char-count').textContent = `${state.text.length} / 1500`;
  $('label').disabled = !state.labelEnabled;
  $('transparent').disabled = state.format === 'mp4';
  $('transparent').checked = state.transparent;
  $('speed').disabled = state.motion === 'static'; $('gap').disabled = state.motion === 'static';
  $('static-duration').disabled = state.motion !== 'static';
  $('custom-size').hidden = state.resolution !== 'custom';
  const descriptions = { webm: 'WebM čuva prozirnost i zauzima malo prostora. Preporučeno za OBS.', mov: 'ProRes 4444 čuva alpha kanal uz visok kvalitet. Fajl može biti znatno veći.', mp4: 'MP4 nema prozirnost. Pozadina van trake biće crna. Za alpha kanal izaberi WebM ili MOV.' };
  $('format-note').textContent = descriptions[state.format];
  const outH = state.scope === 'strip' ? geometry.barHeight : geometry.height;
  $('export-summary').textContent = `${geometry.width} × ${outH} · ${state.fps} FPS`;
  $('preview-size').textContent = `${geometry.width} × ${geometry.height}`;
  $('duration-label').textContent = state.motion === 'static' ? 'Statičan kajron' : 'Jedan savršen loop';
  $('duration-info').textContent = `${geometry.duration.toFixed(2)} s · ${geometry.frames} frejmova${state.scope === 'frame' && geometry.width >= 2560 ? ' · Veći kadar zahteva dužu obradu.' : ''}`;
  if (preview.width !== geometry.width || preview.height !== geometry.height) { preview.width = geometry.width; preview.height = geometry.height; }
  $('stage').style.aspectRatio = `${geometry.width} / ${geometry.height}`;
  $('play').textContent = playing ? 'Ⅱ' : '▶'; $('play').setAttribute('aria-label', playing ? 'Pauziraj pregled' : 'Pokreni pregled');
  document.querySelectorAll('[data-preset]').forEach(b => { b.classList.toggle('selected', b.dataset.preset === state.preset); b.setAttribute('aria-pressed', String(b.dataset.preset === state.preset)); });
  playTime %= geometry.duration; paintPreview(playTime);
  updateGraphicTools();
}
for (const [key, id] of Object.entries(bindings)) {
  const el = $(id);
  el.addEventListener('input', () => {
    if (el.type === 'number' && (!el.value || !el.validity.valid)) return;
    let value = el.type === 'checkbox' ? el.checked : typeof defaults[key] === 'number' ? Number(el.value) : el.value;
    const previous = state.format;
    state = sanitize({ ...state, [key]: value });
    if (key === 'format' && previous === 'mp4' && state.format !== 'mp4') state.transparent = true;
    if (['barColor','accentColor','textColor','labelColor','opacity','radius','bold','font','label','labelEnabled','labelUppercase','labelShape','barStyle','textX','textY','textWidth','textHeight'].includes(key)) state.preset = 'custom';
    playTime = 0; updateUI(); persist();
  });
  if (el.type === 'number') el.addEventListener('change', () => { el.value = state[key]; });
}
document.querySelectorAll('[data-tab]').forEach((button, i, buttons) => {
  button.addEventListener('click', () => { buttons.forEach(b => { const active = b === button; b.setAttribute('aria-selected', String(active)); b.tabIndex = active ? 0 : -1; $(b.dataset.tab + '-panel').hidden = !active; }); });
  button.addEventListener('keydown', e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const b = buttons[(i + (e.key === 'ArrowRight' ? 1 : buttons.length - 1)) % buttons.length]; b.click(); b.focus(); } });
  button.tabIndex = i ? -1 : 0;
});
const styles = Object.fromEntries(STUDIO_DESIGNS.map(item=>[item.id,item.settings]));
function applyDesign(id) {
  if(!styles[id])return;
  const chosen={...styles[id]};
  if(window.KajronI18n.language==='en')chosen.label=({UŽIVO:'LIVE',VESTI:'NEWS',NAJNOVIJE:'BREAKING',SPORT:'SPORT',BIZNIS:'BUSINESS'})[chosen.label]||chosen.label;
  state = sanitize({...state,...chosen,graphics:[],preset:id});
  updateUI(true);persist();updateGraphicTools(true);refreshExportAction();
}
document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>applyDesign(b.dataset.preset)));
$('play').addEventListener('click', () => { playing = !playing; updateUI(); });
$('restart').addEventListener('click', () => { playTime = 0; paintPreview(0); });
function tick(now) { const delta = Math.min((now - lastTime) / 1000, .1); lastTime = now; if (playing && !document.hidden) { playTime = (playTime + delta) % geometry.duration; paintPreview(playTime); } $('timecode').innerHTML = `${formatTime(playTime)} <span>/ ${formatTime(geometry.duration)}</span>`; $('timeline-progress').style.width = `${playTime / geometry.duration * 100}%`; requestAnimationFrame(tick); }
for (const mode of ['transparent', 'scene']) $('bg-' + mode).addEventListener('click', () => { $('stage').classList.toggle('scene-on', mode === 'scene'); for (const item of ['transparent', 'scene']) { $('bg-' + item).classList.toggle('active', item === mode); $('bg-' + item).setAttribute('aria-pressed', String(item === mode)); } });
$('fullscreen').addEventListener('click', async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else if ($('stage').requestFullscreen) await $('stage').requestFullscreen(); else toast('Ovaj pregledač ne podržava pregled preko celog ekrana.'); } catch { toast('Pregled preko celog ekrana nije dostupan.'); } });
function openGuide() { if (!$('guide').open) $('guide').showModal(); }
for (const id of ['guide-open', 'guide-bottom']) $(id).addEventListener('click', openGuide);
for (const id of ['guide-close', 'guide-done']) $(id).addEventListener('click', () => $('guide').close());
$('guide').addEventListener('click', e => { if (e.target === $('guide')) { const r = e.target.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) e.target.close(); } });
$('studio-nav').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
$('reset').addEventListener('click', () => { state = { ...defaults }; playTime = 0; updateUI(true); persist(); toast('Vraćena su početna podešavanja.'); });
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; if (!c.getContext('2d')) throw new Error('Pregledač ne može da napravi sliku ove veličine.'); return c; }
async function pngBytes(c) { const blob = await new Promise(resolve => c.toBlob(resolve, 'image/png')); if (!blob) throw new Error('Tekst je predugačak za ovu veličinu slova. Skrati tekst ili smanji slova.'); return new Uint8Array(await blob.arrayBuffer()); }
async function renderLayers(s, g) {
  if(!s.textOnly)await ensureGraphicImages(s.graphics);
  const strip = s.scope === 'strip', h = strip ? g.barHeight : g.height;
  const base = makeCanvas(g.width, h), fg = makeCanvas(g.width, h);
  paintBase(base.getContext('2d'), s, g, strip, !s.transparent);
  paintForeground(fg.getContext('2d'), s, g, strip);
  // A transparent mask gives preview and exports the same rounded clipping.
  const mask = makeCanvas(g.width, h), mc = mask.getContext('2d');
  roundedPath(mc, 0, strip ? 0 : g.barY, g.width, g.barHeight, s.radius); mc.fillStyle = '#ffffff'; mc.fill();
  const trackWidth = s.motion === 'static' ? g.contentWidth : Math.ceil(g.period + g.contentWidth + 32);
  if (trackWidth > 32760) throw new Error('Tekst je predugačak za ovu veličinu slova. Skrati tekst ili smanji slova, pa ponovi izvoz.');
  const track = makeCanvas(Math.max(2, trackWidth), g.contentHeight), tc = track.getContext('2d');
  tc.font = textFont(s); tc.fillStyle = s.textColor; tc.textBaseline = 'middle';
  if (s.motion === 'static') tc.fillText(g.text, 30, g.contentHeight / 2 + s.fontSize * .04);
  else for (let x = 30; x < track.width; x += g.period) tc.fillText(g.text, x, g.contentHeight / 2 + s.fontSize * .04);
  return { base: await pngBytes(base), track: await pngBytes(track), fg: await pngBytes(fg), mask: await pngBytes(mask), h };
}
function buildCommand(s, g) {
  const h = s.scope === 'strip' ? g.barHeight : g.height, y = s.scope === 'strip' ? 0 : g.barY;
  const x = s.motion === 'static' ? '0' : s.motion === 'right' ? `mod(${g.period}-mod(n*${g.period}/${g.frames}\\,${g.period})\\,${g.period})` : `mod(n*${g.period}/${g.frames}\\,${g.period})`;
  const inputs = ['base.png', 'track.png', 'foreground.png', 'mask.png'].flatMap(name => ['-loop', '1', '-framerate', String(s.fps), '-i', name]);
  const tx=g.contentX ?? g.labelWidth, ty=y+(g.contentY||0), th=g.contentHeight||g.barHeight;
  let filters = `[1:v]format=rgba,crop=${g.contentWidth}:${th}:${x}:0:exact=1[cropped];color=c=black@0.0:s=${g.width}x${h}:r=${s.fps},format=rgba[canvas];[canvas][cropped]overlay=${tx}:${ty}:format=auto:shortest=1[textfull];[textfull]split=2[textcolor][textalpha];[textalpha]alphaextract[originalalpha];[3:v]alphaextract[mask];[originalalpha][mask]blend=all_mode=multiply[finalalpha];[textcolor][finalalpha]alphamerge[maskedtext];[0:v]format=rgba[base];[base][maskedtext]overlay=0:0:format=auto:shortest=1[bar];[bar][2:v]overlay=0:0:format=auto:shortest=1[rounded]`;
  // Keep full color resolution until the encoder chooses its required format.
  // Converting PNG/ProRes through 4:2:0 first destroys fine colored text edges.
  if (!s.transparent) filters += `;color=c=black:s=${g.width}x${h}:r=${s.fps},format=rgba[black];[black][rounded]overlay=0:0:format=auto:shortest=1,format=rgba[out]`;
  else filters += ';[rounded]format=rgba[out]';
  let codec;
  if (s.format === 'webm') codec = ['-c:v', 'libvpx', '-pix_fmt', s.transparent ? 'yuva420p' : 'yuv420p', '-b:v', '4M', '-crf', '10', '-deadline', 'realtime', '-cpu-used', '5', '-lag-in-frames', '0', '-auto-alt-ref', '0'];
  else if (s.format === 'mov') codec = ['-c:v', 'prores_ks', '-profile:v', '4', '-pix_fmt', 'yuva444p10le', '-alpha_bits', s.transparent ? '16' : '0', '-vendor', 'apl0'];
  else codec = ['-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];
  return ['-y', '-filter_complex_threads', '1', ...inputs, '-filter_complex', filters, '-map', '[out]', '-frames:v', String(g.frames), '-r', String(s.fps), ...codec, '-an', '-threads', '1', `kajron.${s.format}`];
}
