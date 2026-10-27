#!/usr/bin/env python3
"""Build a self-contained, offline Apple Silicon .app from local dependencies."""
import argparse
import os
import plistlib
import re
import shutil
import stat
import subprocess
from pathlib import Path

from ui import prepare_ui

ROOT = Path(__file__).resolve().parent.parent

def run(*args):
    return subprocess.check_output([str(a) for a in args], stderr=subprocess.STDOUT, text=True)

def dependencies(binary):
    return [line.strip().split(' (compatibility')[0] for line in run('otool', '-L', binary).splitlines()[1:] if ' (compatibility' in line]

def build(destination, ffmpeg):
    app = destination / 'Kajron Atomic Studio.app'
    if app.exists():
        raise SystemExit(f'Build destination exists: {app}. Choose a fresh output directory.')
    contents = app / 'Contents'
    resources = contents / 'Resources'
    ui = resources / 'ui'
    binaries = resources / 'bin'
    frameworks = contents / 'Frameworks'
    macos = contents / 'MacOS'
    for directory in [ui, binaries, frameworks, macos]:
        directory.mkdir(parents=True, exist_ok=True)

    prepare_ui(ui)
    shutil.copy2(ROOT / "desktop/translations.json", resources / "translations.json")

    print('Bundling local video encoder and shared libraries…', flush=True)
    engine = binaries / 'ffmpeg'
    shutil.copy2(ffmpeg, engine)
    copied = {}
    pending = [ffmpeg]
    graph = {}
    while pending:
        origin = pending.pop()
        actual = origin.resolve()
        if actual in graph:
            continue
        refs = []
        for dep in dependencies(origin):
            if dep.startswith('/System/') or dep.startswith('/usr/lib/'):
                continue
            if dep.startswith('@loader_path/'):
                path = origin.parent / dep.removeprefix('@loader_path/')
            elif dep.startswith('@rpath/'):
                suffix = dep.removeprefix('@rpath/')
                candidates = [origin.parent / suffix, Path('/opt/homebrew/lib') / suffix]
                path = next((p for p in candidates if p.exists()), None)
                if path is None:
                    raise RuntimeError(f'Cannot resolve {dep} for {origin}')
            else:
                path = Path(dep)
            key = path.resolve()
            # A dylib lists its own install name as its first dependency.
            if key == actual:
                continue
            if key not in copied:
                dest = frameworks / path.name
                if dest.exists():
                    raise RuntimeError(f'Duplicate library name: {path.name}')
                shutil.copy2(path, dest)
                copied[key] = dest
                pending.append(path)
            refs.append((dep, key))
        graph[actual] = refs

    for origin, refs in graph.items():
        target = engine if origin == ffmpeg.resolve() else copied[origin]
        target.chmod(target.stat().st_mode | stat.S_IWUSR)
        subprocess.run(['codesign', '--remove-signature', str(target)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        changes = []
        for dep, key in refs:
            prefix = '@loader_path/../../Frameworks/' if target == engine else '@loader_path/'
            changes += ['-change', dep, prefix + copied[key].name]
        if target != engine:
            changes += ['-id', '@loader_path/' + target.name]
        if changes:
            run('install_name_tool', *changes, target)
    for target in [*copied.values(), engine]:
        run('codesign', '--force', '--sign', '-', target)

    minimum = (13, 0)
    for binary in [engine, *copied.values()]:
        match = re.search(r'\bminos\s+(\d+)\.(\d+)', run('vtool', '-show-build', binary))
        if match:
            minimum = max(minimum, tuple(map(int, match.groups())))
    minimum_version = '.'.join(map(str, minimum))
    print('Compiling native macOS application…', flush=True)
    run('swiftc', '-O', '-swift-version', '5', '-target', f'arm64-apple-macos{minimum_version}', '-framework', 'AppKit', '-framework', 'WebKit', ROOT / 'desktop/KajronStudio.swift', '-o', macos / 'KajronAtomicStudio')
    info = {
        'CFBundleName': 'Kajron Atomic Studio', 'CFBundleDisplayName': 'Kajron Atomic Studio',
        'CFBundleIdentifier': 'rs.kajron.studio.local', 'CFBundleExecutable': 'KajronAtomicStudio',
        'CFBundlePackageType': 'APPL', 'CFBundleShortVersionString': '1.5.2', 'CFBundleVersion': '8',
        'LSMinimumSystemVersion': minimum_version, 'NSHighResolutionCapable': True, 'CFBundleIconFile': 'AppIcon.icns',
        'NSPrincipalClass': 'NSApplication', 'NSHumanReadableCopyright': 'Kajron Atomic Studio · Local OBS media generator',
    }
    with (contents / 'Info.plist').open('wb') as f:
        plistlib.dump(info, f)
    shutil.copy2(ROOT / 'desktop/AppIcon.icns', resources / 'AppIcon.icns')
    notices = resources / 'Licenses'
    notices.mkdir()
    for source in (ROOT / 'desktop/encoder-licenses').glob('*'):
        shutil.copy2(source, notices / source.name)
    for name in ['LICENSE', 'THIRD_PARTY_NOTICES.md']:
        shutil.copy2(ROOT / name, notices / name)
    shutil.copy2(ROOT / 'desktop/encoder-sources.json', notices / 'encoder-sources.json')
    (notices / 'FFmpeg-build.txt').write_text(run(ffmpeg, '-version') + '\nCorresponding source and build instructions: https://github.com/srdjankotarlic/kajron-atomic-studio/releases/tag/v1.5.2\n')
    run('codesign', '--force', '--deep', '--sign', '-', app)
    run('codesign', '--verify', '--deep', '--strict', app)
    # Ensure the bundled engine has no dependency on a Homebrew installation.
    for target in [engine, *copied.values()]:
        for dep in dependencies(target):
            if dep.startswith('/opt/') or dep.startswith('/usr/local/'):
                raise RuntimeError(f'Unbundled dependency: {target}: {dep}')
    print(run(engine, '-version').splitlines()[0], flush=True)
    print(f'Built: {app}\nBundled libraries: {len(copied)}', flush=True)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--ffmpeg', type=Path, default=Path(shutil.which('ffmpeg') or '/opt/homebrew/bin/ffmpeg'))
    args = parser.parse_args()
    build(args.output.resolve(), args.ffmpeg)
