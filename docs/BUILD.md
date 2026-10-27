# Building Kajron Atomic Studio 2.0

End users should download the ready-made release. These instructions are for developers.
No private credentials or service accounts are needed to build.

## Source layout

- `desktop/base/`: shared HTML, CSS and Canvas renderer sources.
- `desktop/ui.py`: assembles the offline UI and common native renderer.
- `desktop/i18n.js`, `translations.json`: English / Serbian interface and messages.
- `desktop/KajronStudio.swift`: native macOS shell, dialogs, fonts and export process.
- `desktop/windows/`: Electron shell, sandboxed preload and Windows export backend.
- `desktop/graphics.js`, `designs.json`, `design-tools.*`: image layers, editable designs and local UI.
- `desktop/encoding.js`: shared codec and quality settings.
- `desktop/build_encoder.py`: minimal FFmpeg and dependency build recipe.

## Encoder sources

Download the **Encoder-Sources** archive from the same GitHub release and extract
its four upstream archives into `outputs/public-sources/`. Their exact checksums
are also in `desktop/encoder-sources.json`. The build script can download them
from the recorded official URLs if they are missing.

On an Apple Silicon Mac, install Xcode Command Line Tools, Python 3.12+, CMake,
make, nasm and pkg-config. Python packaging uses Pillow (`python3 -m pip install Pillow`).

```sh
python3 desktop/build_encoder.py macos
```

The build uses `/tmp/kajron-atomic-encoder/macos` by default. Set
`KAJRON_ENCODER_WORK` to another directory **without spaces** if necessary.
Build logs record the full configure commands. No source patches are applied.

## macOS app

```sh
python3 desktop/build.py --output outputs/macos \
  --ffmpeg /tmp/kajron-atomic-encoder/macos/bin/ffmpeg
codesign --verify --deep --strict 'outputs/macos/Kajron Atomic Studio.app'
```

Build on Apple Silicon. Release 1.5 targets macOS 13 or newer. The builder checks
native dependency load paths and signs the app ad-hoc. Publisher signing and
notarization require the maintainer's separate Apple certificates and account.

## Windows app, cross-built on macOS

Download and extract the official
[LLVM-MinGW 20261020 UCRT macOS universal toolchain](https://github.com/mstorsjo/llvm-mingw/releases/tag/20261020)
into `outputs/cache/llvm-mingw-20261020-ucrt-macos-universal/`.

```sh
python3 desktop/build_encoder.py windows
cp /tmp/kajron-atomic-encoder/windows/bin/ffmpeg.exe outputs/cache/atomic-ffmpeg-win64.exe
```

Place these official Electron release assets in `outputs/cache/`:

- `electron-v45.0.0-win32-x64.zip`
- `electron-v45.0.0-SHASUMS256.txt` (download `SHASUMS256.txt` and rename it)

Both are at <https://github.com/electron/electron/releases/tag/v45.0.0>.
The Windows builder verifies the archive against the official checksum manifest.
Install NSIS (`makensis`) and Pillow, then run:

```sh
python3 desktop/windows/build.py --output outputs/windows
```

This creates the complete portable folder, a ZIP and a per-user NSIS installer.
It bundles the encoder and official Electron dependencies. The installer supports
English and Serbian Latin; the app language can be changed independently.

## Verification

```sh
node --test tests/*.test.cjs
python3 desktop/verify_exports.py --output qa/exports \
  --engine /tmp/kajron-atomic-encoder/macos/bin/ffmpeg
```

The export check uses Pillow and a separate full FFmpeg/ffprobe installation to
decode and inspect outputs. The bundled encoder intentionally only reads PNG
layers and encodes the supported formats; it is not a general-purpose decoder.

The Windows smoke test can run against a disposable copy of the portable package. Copy `tests/windows-smoke.cjs` into `resources/app/smoke.cjs`, change that copy's `package.json` main to `smoke.cjs`, and launch its executable with `KAJRON_SMOKE_REPORT` pointing to a JSON report path. It loads the bundled renderer, switches languages, imports a system font and performs real exports with the Windows encoder. It uses sample text and a temporary user-data folder. Do not modify an installed user copy for this test.


The native Windows suite also checks the 15 designs, native image import, SVG
rasterization, a portable project restored into an empty image library, user
design persistence, text-only mode with retained hidden artwork, and PNG frames
in exported MOVs compared with the actual preview. Only picker answers are
stubbed; the shipped renderer, IPC, image storage and encoder remain real.

For a Mac test profile, build the app, then run:

```sh
python3 tests/mac_graphics.py --app 'outputs/macos/Kajron Atomic Studio.app' --output qa/mac-graphics
```

Open its generated QA app, wait for `report.json`, quit it, then reopen it for
`restart.json`. It uses a separate bundle ID and font/image storage folders.
Picker answers point at generated fixtures. Check the report's `pass` field and
compare the exported PNG frames with its embedded expected preview images.
Never distribute the QA app or its test profile.
