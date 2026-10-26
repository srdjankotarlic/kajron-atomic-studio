# Validation — 1.5.0

| Check | Result |
| --- | --- |
| macOS native build and ad-hoc signature verification | Passed |
| English / Serbian UI, native menu switching, text preservation | Passed in the running Mac application |
| Language persistence and dynamic status translation | Passed automated tests |
| Imported font load and persistence | Passed in the Mac app; Windows storage/import functions checked with real font bytes |
| MP4 / H.264, WebM / VP9, MOV / PNG and MOV / ProRes | Passed actual encoder tests on both platform binaries |
| Text-only transparency in WebM and MOV | Passed; decoded frames checked for transparent empty regions and visible letters |
| Output dimensions and duration | Passed on decoded test files |
| Compact MOV comparison | About 72% smaller than ProRes in the synthetic test; actual sizes vary |
| Windows runtime dependency inspection | Only system Windows DLLs required by the standalone encoder |
| Mac encoder dependency inspection | Only system macOS frameworks; no Homebrew libraries required |

Windows encoder tests run the actual Windows executable through an isolated
CrossOver/Wine environment. This does not constitute interactive testing on a
physical Windows computer. The repository includes `tests/windows-smoke.cjs`
for a native Windows Electron/renderer/export check on a disposable test copy.

The app packages contain no user projects, imported fonts, saved preferences or
sample exports made from private text. Release archive integrity and SHA-256
checks are performed before publication.

The Mac app targets Apple Silicon and macOS 13+. The Windows app targets 64-bit
Windows 10/11. Intel Mac and Windows ARM64 builds are not provided. The Windows
installer is unsigned and the Mac app is not notarized.

Tests verify correct files, transparency and supported workflows. Font rasterization,
codec support in other editing tools, display scaling and GPU behavior can vary
between computers. Report reproducible problems through GitHub Issues.
