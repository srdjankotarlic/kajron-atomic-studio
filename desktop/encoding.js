// Shared by native macOS and Windows. Never used by the WASM web prototype.
function desktopCodecOptions(s, g) {
  const quality = s.quality || 'compact';
  const crf = quality === 'high' ? 20 : quality === 'balanced' ? 25 : 29;
  if (s.format === 'mp4') return ['-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];
  if (s.format === 'webm') return ['-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', quality === 'high' ? '24' : quality === 'balanced' ? '31' : '36', '-deadline', 'good', '-cpu-used', '5', '-row-mt', '1', '-lag-in-frames', '0', '-auto-alt-ref', '0', '-pix_fmt', s.transparent ? 'yuva420p' : 'yuv420p'];
  if (quality === 'high') return ['-c:v', 'prores_ks', '-profile:v', '4', '-pix_fmt', 'yuva444p10le', '-alpha_bits', s.transparent ? '16' : '0', '-vendor', 'apl0'];
  return ['-c:v', 'png', '-pix_fmt', 'rgba', '-pred', 'mixed', '-compression_level', quality === 'compact' ? '9' : '6', '-movflags', '+faststart'];
}
function desktopFormatDescription(s) {
  if (s.format === 'webm') return 'WebM VP9: mali fajl sa prozirnošću. Preporučeno za OBS; kompresija može trajati duže.';
  if (s.format === 'mp4') return 'MP4 H.264: mali video sa punom pozadinom. Za prozirnost izaberi WebM ili MOV.';
  if (s.quality === 'high') return 'MOV ProRes 4444: namenjen montaži i daje velike fajlove. Za manje fajlove izaberi „Manji fajl” ili WebM.';
  return 'MOV PNG: kompresija bez gubitka kvaliteta, sa alpha kanalom za OBS. Za još manje fajlove izaberi WebM.';
}
if (typeof module !== 'undefined') module.exports = { desktopCodecOptions, desktopFormatDescription };
