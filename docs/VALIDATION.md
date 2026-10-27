# Validation — 2.0.0

## Native graphics and video checks

- All 12 automated regression tests pass, including immediate saves, font races,
  language preservation, image deduplication and mismatched image-ID rejection.
- Mac native integration passes with a separate profile and automated picker
  answers: TTF import, 15 designs, PNG/JPG/WebP/SVG imports with a broken PNG,
  portable project save/open with embedded artwork, saved user designs, graphics
  outside the ticker strip, and image/text-only MOV exports.
- Mac decoded MOV frames match the actual preview within one color level with
  a custom bold font and graphics; text-only output matches exactly. Empty
  regions are transparent. The same text/label bitmap drawing is used in preview
  and export to avoid platform font-synthesis differences.
- Restarting the Mac QA app restores its text, imported font, both placed graphics
  and saved designs. The test profile is separate from the installed user's app.
- All 64000 RGBA pixels match exactly in four MOV PNG alpha/quality combinations.
- Passed: [final native Windows run](https://github.com/srdjankotarlic/kajron-atomic-studio/actions/runs/40556535189).

The Windows suite runs the shipped main process, trusted IPC, sandboxed renderer,
font/image storage and encoder. It checks the 15 designs, mixed image import,
actual pointer dragging, layers outside the strip, custom labels and imported
bold fonts, image-embedded projects restored into an empty graphics library,
saved design persistence and text-only output with hidden retained images.
Separate Pillow checks decode PNG frames inside MOV files and compare them with
the actual preview, including alpha. Native picker answers are automated.

The existing six-format export, cancellation, overwrite, invalid-input and minimum
window checks also run. The installer is installed, reinstalled and uninstalled
while an unrelated user file is retained. Archive integrity and uploaded asset
SHA-256 digests are checked before publication. No client images, imported fonts,
user preferences or projects are bundled in the release.

These checks cover the supported workflows and fixtures, not every possible font,
SVG, codec consumer, GPU or display configuration. Supported platforms and signing
limits remain Windows 10/11 x64 and Apple Silicon Mac/macOS 13+; Windows is unsigned,
and the Mac app is ad-hoc signed rather than notarized. Static image import and
size limits are documented in the README.

## Previous verification — 1.5.2

This release only removes the introductory banner from the shared HTML and updates
package version metadata. The editor and preview are the first content in `main`
in both Mac and Windows packages; no empty heading container remains.

- All 10 existing automated regression tests passed.
- The native Mac build and deep/strict ad-hoc signature verification passed.
- The updated installed Mac app was opened: the banner is absent and the existing
  project, selected settings and imported-font library are retained.
- Both completed ZIP archives passed integrity checks. Their packaged HTML was
  checked for the removed banner and the presence of all primary editing/export
  controls. Uploaded release files match local SHA-256 hashes.
- Passed: [native Windows verification for these exact 1.5.2 packages](https://github.com/srdjankotarlic/kajron-atomic-studio/actions/runs/40513902324).

The unchanged encoder and rendering behavior were also checked in the preceding
release as recorded below. These are historical results, not additional Mac
export runs performed for this HTML-only change.

## Previous verification — 1.5.1

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
