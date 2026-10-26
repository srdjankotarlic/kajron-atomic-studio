#!/usr/bin/env python3
"""Cross-build the offline Windows x64 package and NSIS installer on macOS."""
import argparse
import gzip
import hashlib
import json
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from ui import prepare_ui, ROOT

def build(output):
    output = output.resolve()
    cache = ROOT / 'outputs/cache'
    runtime = cache / 'electron-v45.0.0-win32-x64.zip'
    checksums = (cache / 'electron-v45.0.0-SHASUMS256.txt').read_text()
    expected = next(line.split()[0] for line in checksums.splitlines() if line.split()[-1].lstrip('*') == runtime.name)
    if hashlib.sha256(runtime.read_bytes()).hexdigest() != expected:
        raise RuntimeError('Electron checksum does not match the official release.')
    payload = output / 'Kajron Atomic Studio Windows'
    if payload.exists():
        raise RuntimeError('Choose a fresh output directory.')
    payload.mkdir(parents=True)
    with zipfile.ZipFile(runtime) as z:
        z.extractall(payload)
    (payload / 'electron.exe').rename(payload / 'Kajron Atomic Studio.exe')
    if (payload / 'electron_wer.dll').exists():
        (payload / 'electron_wer.dll').rename(payload / 'Kajron Atomic Studio_wer.dll')
    # This package uses a normal resources/app directory, per Electron's packaging contract.
    (payload / 'resources/default_app.asar').unlink(missing_ok=True)
    app = payload / 'resources/app'
    app.mkdir()
    for filename in ['package.json', 'main.cjs', 'preload.cjs', 'exporter.cjs']:
        shutil.copy2(ROOT / 'desktop/windows' / filename, app / filename)
    shutil.copy2(ROOT / 'desktop/translations.json', app / 'translations.json')
    prepare_ui(app / 'ui')
    script = app / 'ui/app.js'
    text = script.read_text().replace("const native = (message) => window.webkit.messageHandlers.desktop.postMessage(message);", "const native = (message) => window.kajronDesktop.send(message);\nwindow.kajronDesktop.onEvent(event => window.desktopEvent?.(event));")
    script.write_text(text)
    index = app / 'ui/index.html'
    html = index.read_text().replace('<meta charset="utf-8">', '<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: blob:; font-src \'self\'; connect-src \'none\'; object-src \'none\'; base-uri \'none\'; form-action \'none\'">')
    index.write_text(html)
    # Generate the Windows icon from the app's existing local icon asset.
    from PIL import Image
    Image.open(ROOT / 'desktop/AppIcon.icns').convert('RGBA').save(app / 'icon.ico', sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
    binary = app / 'bin'
    binary.mkdir()
    engine = cache / 'atomic-ffmpeg-win64.exe'
    shutil.copy2(engine, binary / 'ffmpeg.exe')
    licenses = app / 'Licenses'
    licenses.mkdir()
    for source in (ROOT / 'desktop/encoder-licenses').glob('*'):
        shutil.copy2(source, licenses / source.name)
    for name in ['LICENSE', 'THIRD_PARTY_NOTICES.md']:
        shutil.copy2(ROOT / name, licenses / name)
    shutil.copy2(ROOT / 'desktop/encoder-sources.json', licenses / 'encoder-sources.json')
    (app / 'BUILD-PROVENANCE.json').write_text(json.dumps({
        'app_version': '1.5.0', 'platform': 'win32-x64', 'electron_version': '45.0.0',
        'electron_release': 'https://github.com/electron/electron/releases/tag/v45.0.0',
        'electron_zip_sha256': expected,
        'ffmpeg_source': 'https://github.com/srdjankotarlic/kajron-atomic-studio/releases/tag/v1.5.0',
        'ffmpeg_version': '8.1.2',
        'ffmpeg_exe_sha256': hashlib.sha256(engine.read_bytes()).hexdigest(),
        'encoder_sources': json.loads((ROOT / 'desktop/encoder-sources.json').read_text())
    }, indent=2))
    (payload / 'README.txt').write_text('KAJRON ATOMIC STUDIO 1.5 — WINDOWS 10/11 x64\n\nRun Kajron Atomic Studio.exe. Keep this entire folder together. Works offline.\nChoose English / Srpski at the top of the app.\nFor smaller files: WebM + Smaller file + Ticker strip only.\nFor transparent text: Text only, then export WebM or MOV.\nOBS: Media Source > Local File > choose the exported video > Loop.\n\nPokreni Kajron Atomic Studio.exe. Prenesi CEO folder. Radi bez interneta.\nNa vrhu izaberi English / Srpski. Za prozirnost: Samo slova, WebM ili MOV.\n\nDownloads, help, licenses and encoder sources:\nhttps://github.com/srdjankotarlic/kajron-atomic-studio\nThis build is unsigned / Paket nema izdavacki digitalni potpis.\n', encoding='utf-8')
    for f in [*app.glob('*.cjs'), script]:
        subprocess.run(['node', '--check', str(f)], check=True)
    package(payload, output)

def package(payload, output):
    files = [p for p in payload.rglob('*') if p.is_file()]
    delete_list = output / 'delete-files.nsh'
    commands = ['Delete "$INSTDIR\\' + str(p.relative_to(payload)).replace('/', '\\') + '"' for p in files]
    folders = sorted([p for p in payload.rglob('*') if p.is_dir()], key=lambda p: len(p.parts), reverse=True)
    commands += ['RMDir "$INSTDIR\\' + str(p.relative_to(payload)).replace('/', '\\') + '"' for p in folders]
    delete_list.write_text('\n'.join(commands) + '\n')
    installer = output / 'Kajron-Atomic-Studio-Setup-1.5.0.exe'
    subprocess.run(['makensis', '-V2', f'-DPAYLOAD={payload}', f'-DINSTALLER={installer}', f'-DDELETE_LIST={delete_list}', f'-DSIZE_KB={sum(p.stat().st_size for p in files)//1024}', str(ROOT / 'desktop/windows/installer.nsi')], check=True)
    portable = output / 'Kajron-Atomic-Studio-Windows-Portable-1.5.0.zip'
    with zipfile.ZipFile(portable, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for f in files:
            z.write(f, f.relative_to(output))
    for artifact in [installer, portable]:
        digest = hashlib.sha256(artifact.read_bytes()).hexdigest()
        artifact.with_suffix(artifact.suffix + '.sha256').write_text(f'{digest}  {artifact.name}\n')
        print(f'{artifact} ({artifact.stat().st_size / 1048576:.1f} MB)', flush=True)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--package-only', action='store_true')
    args = parser.parse_args()
    if args.package_only:
        output = args.output.resolve()
        package(output / 'Kajron Atomic Studio Windows', output)
    else:
        build(args.output)
