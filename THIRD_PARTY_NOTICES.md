# Third party software / Biblioteke drugih autora

The Kajron Atomic Studio application sources are MIT licensed. The desktop app
executes a separate FFmpeg process; it does not link FFmpeg into the application.
Bundled third party components retain their own licenses and copyrights.

## Video encoder

Release 1.5.0 includes a minimal FFmpeg 8.1.2 build compiled from the following
unmodified source archives. Exact URLs and SHA-256 hashes are recorded in
[`desktop/encoder-sources.json`](desktop/encoder-sources.json).

| Component | Version | License |
| --- | --- | --- |
| [FFmpeg](https://ffmpeg.org/) | 8.1.2 | GPL 2.0 or later for this `--enable-gpl` configuration |
| [x264](https://www.videolan.org/developers/x264.html) | b35605ace3ddf7c1a5d67a2eb553f034aef41d55 | GPL 2.0 or later |
| [libvpx](https://www.webmproject.org/code/) | 1.16.0 | BSD 3-Clause; upstream PATENTS grant included |
| [zlib](https://zlib.net/) | 1.3.1 | zlib license |

The **Encoder-Sources** archive beside the installers in
[Releases](https://github.com/srdjankotarlic/kajron-atomic-studio/releases)
contains all four exact source archives, their checksums, the build script,
configuration commands and license files. No FFmpeg source modifications are
made. `desktop/build_encoder.py` records the complete configuration used for each
platform. GPL source is provided at the same download location as the binaries,
following the [FFmpeg distribution guidance](https://ffmpeg.org/legal.html).

License copies are in `desktop/encoder-licenses/` and in each application package.
Only file and pipe protocols are enabled in this encoder; it has no network
protocol support.

## Windows application runtime

The Windows package contains the official
[Electron 45.0.0](https://github.com/electron/electron/releases/tag/v45.0.0)
win32-x64 distribution, verified against its official SHA-256 manifest.
Electron's MIT license and Chromium's complete notices are included as `LICENSE`
and `LICENSES.chromium.html` at the root of the Windows application folder.
The source and notices for Electron and its dependencies remain available through
[Electron's source repository](https://github.com/electron/electron/tree/v45.0.0).

The cross compiler is [LLVM-MinGW 20261020](https://github.com/mstorsjo/llvm-mingw/releases/tag/20261020),
using the system Windows UCRT. It is a build tool and is not part of the installer.

## Fonts and user data

No imported user fonts, user projects or user videos are included in releases.
The four built-in font choices refer to fonts provided by the operating system;
actual availability can differ. Fonts imported by the user are copied only into
that user's private application library. Their licenses remain with their owners.

---

Aplikacija koristi zaseban FFmpeg video-pogon. Njegove GPL licence i licence
biblioteka uključene su u pakete. Potpun izvorni kod pogona i uputstvo za izgradnju
nalaze se u arhivi **Encoder-Sources**, na istoj Releases stranici kao instalateri.
Lični tekstovi, projekti, video-fajlovi i dodati fontovi nisu deo javnih paketa.
