'use strict';
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { randomUUID } = require('node:crypto');

function validateExport(message) {
  if (!message || !['mp4', 'mov', 'webm'].includes(message.format)) throw new Error('Format videa nije ispravan.');
  if (!Array.isArray(message.args) || message.args.length > 150 || !message.args.every(v => typeof v === 'string' && v.length < 32768)) throw new Error('Podešavanja videa nisu ispravna.');
  if (message.args.at(-1) !== `kajron.${message.format}`) throw new Error('Izlazni format nije ispravan.');
  if (!Number.isSafeInteger(message.frames) || message.frames < 1 || message.frames > 1000000) throw new Error('Trajanje videa nije ispravno.');
  for (const key of ['base', 'track', 'fg', 'mask']) {
    if (typeof message.layers?.[key] !== 'string' || message.layers[key].length > 130000000) throw new Error('Slika kajrona nije ispravna.');
  }
}
async function renderExport(enginePath, message, target, control, onProgress = () => {}) {
  validateExport(message);
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'kajron-'));
  const staging = path.join(path.dirname(target), `.kajron-${randomUUID()}.${message.format}`);
  let log = '';
  try {
    for (const [key, name] of Object.entries({ base: 'base.png', track: 'track.png', fg: 'foreground.png', mask: 'mask.png' })) {
      const data = Buffer.from(message.layers[key], 'base64');
      if (!data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error('Slika kajrona nije PNG.');
      await fs.writeFile(path.join(folder, name), data);
    }
    if (control.cancelled) return null;
    const output = path.join(folder, `output.${message.format}`);
    const args = message.args.slice(0, -1);
    args.unshift('-nostdin', '-hide_banner', '-progress', 'pipe:1', '-nostats');
    args.push('-f', message.format, output);
    let buffer = '';
    const code = await new Promise((resolve, reject) => {
      const child = spawn(enginePath, args, { cwd: folder, windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
      control.process = child;
      if (control.cancelled) child.kill();
      child.stdout.on('data', data => {
        buffer += data.toString();
        const lines = buffer.split(/\r?\n/); buffer = lines.pop();
        for (const line of lines) if (/^frame=\s*\d+/.test(line)) {
          const frame = Number(line.split('=')[1]);
          onProgress(Math.min(99, 5 + frame / message.frames * 94), `Pravljenje videa · ${frame} / ${message.frames} frejmova`);
        }
      });
      child.stderr.on('data', data => { log = (log + data.toString()).slice(-1000000); });
      child.once('error', reject);
      child.once('close', resolve);
    });
    control.process = null;
    if (control.cancelled) return null;
    if (code !== 0) { const error = new Error('Video nije napravljen. Pokušaj samo traku ili manju rezoluciju.'); error.encoderLog = log; throw error; }
    const info = await fs.stat(output);
    if (info.size === 0) throw new Error('Video-fajl je prazan.');
    await fs.copyFile(output, staging);
    if (control.cancelled) return null;
    await fs.rename(staging, target);
    return { type: 'complete', path: target, name: path.basename(target), format: message.format, bytes: info.size };
  } finally {
    control.process = null;
    await fs.rm(staging, { force: true }).catch(() => {});
    await fs.rm(folder, { recursive: true, force: true }).catch(() => {});
  }
}
module.exports = { validateExport, renderExport };
