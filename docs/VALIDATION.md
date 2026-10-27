# Validation — 1.5.1

**All checks below passed.** [Native Windows run, including installer checks](https://github.com/srdjankotarlic/kajron-atomic-studio/actions/runs/40510628622). The release includes a machine-readable `VERIFICATION.json`.

| Check | Result |
| --- | --- |
| macOS native build and ad-hoc signature verification | Passed |
| English / Serbian UI, native menu switching, text preservation | Passed in the running Mac application |
| Language persistence and dynamic status translation | Passed automated tests |
| Saving the last edit before an immediate restart | Passed on the native Windows renderer and in regression tests |
| Overlapping font loads, startup restore and explicit user choices | Passed regression tests |
| MOV PNG fine color detail | All 64000 RGBA pixels match exactly in four alpha/quality combinations |
| Imported font load and persistence | Passed in the Mac app; Windows storage/import functions checked with real font bytes |
| MP4 / H.264, WebM / VP9, MOV / PNG and MOV / ProRes | Passed actual encoder tests on both platform binaries |
| Text-only transparency in WebM and MOV | Passed; decoded frames checked for transparent empty regions and visible letters |
| Output dimensions and duration | Passed on decoded test files |
| Compact MOV comparison | About 79% smaller than ProRes in the synthetic test; actual sizes vary |
| Windows runtime dependency inspection | Only system Windows DLLs required by the standalone encoder |
| Mac encoder dependency inspection | Only system macOS frameworks; no Homebrew libraries required |

The full Windows integration suite runs on a real GitHub-hosted Windows runner,
using the packaged Electron runtime, the shipped main process, sandboxed preload,
trusted IPC and bundled Windows encoder. Native file picker answers are supplied
by the test so it can run unattended. It checks projects, custom fonts and language
persistence, six export combinations, cancellation, closing during export,
overwriting an existing video, invalid inputs and the minimum window size. A
separate Python/Pillow check compares all 64000 RGBA pixels in a Windows MOV PNG
fixture. Installer, reinstallation and uninstallation are tested while preserving
an unrelated user file.

macOS checks use the native app in a separate test profile: custom-font import
with an invalid file, project save/open, transparent MOV export, 4K cancellation
and font/text persistence after restarting. Exported frames are independently
decoded for alpha-channel checks. Test profiles do not alter user projects.

The app packages contain no user projects, imported fonts, saved preferences or
sample exports made from private text. Release archive integrity and SHA-256
checks are performed before publication.

The Mac app targets Apple Silicon and macOS 13+. The Windows app targets 64-bit
Windows 10/11. Intel Mac and Windows ARM64 builds are not provided. The Windows
installer is unsigned and the Mac app is not notarized.

Tests verify correct files, transparency and supported workflows. Font rasterization,
codec support in other editing tools, display scaling and GPU behavior can vary
between computers. Report reproducible problems through GitHub Issues.
