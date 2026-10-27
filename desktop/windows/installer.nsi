Unicode true
!include "MUI2.nsh"
!include "x64.nsh"
!include "WinVer.nsh"
Name "Kajron Atomic Studio"
OutFile "${INSTALLER}"
InstallDir "$LOCALAPPDATA\Programs\Kajron Atomic Studio"
RequestExecutionLevel user
SetCompressor /SOLID lzma
SetCompressorDictSize 8
BrandingText "Kajron Atomic Studio 1.5 · Offline OBS video ticker"
VIProductVersion "2.0.0.0"
VIAddVersionKey "ProductName" "Kajron Atomic Studio"
VIAddVersionKey "FileDescription" "Kajron Atomic Studio installer"
VIAddVersionKey "FileVersion" "2.0.0"
VIAddVersionKey "LegalCopyright" "Kajron Atomic Studio"
!define MUI_ICON "${PAYLOAD}\resources\app\icon.ico"
!define MUI_UNICON "${PAYLOAD}\resources\app\icon.ico"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "$(WelcomeTitle)"
!define MUI_WELCOMEPAGE_TEXT "$(WelcomeText)"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\Kajron Atomic Studio.exe"
!define MUI_FINISHPAGE_RUN_TEXT "$(RunText)"
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "SerbianLatin"
!insertmacro MUI_RESERVEFILE_LANGDLL
LangString WelcomeTitle ${LANG_ENGLISH} "Kajron Atomic Studio for Windows"
LangString WelcomeTitle ${LANG_SERBIANLATIN} "Kajron Atomic Studio za Windows"
LangString WelcomeText ${LANG_ENGLISH} "Offline OBS video ticker generator.$\r$\n$\r$\nThe app and video encoder are included. No internet or extra runtime installation required.$\r$\n$\r$\nChoose English or Srpski inside the app. Close the previous version before installing."
LangString WelcomeText ${LANG_SERBIANLATIN} "Generator video-kajrona za OBS.$\r$\n$\r$\nAplikacija i video-pogon su uključeni. Internet i dodatna instalacija nisu potrebni.$\r$\n$\r$\nU aplikaciji izaberi English ili Srpski. Zatvorite prethodnu verziju pre instalacije."
LangString RunText ${LANG_ENGLISH} "Launch Kajron Atomic Studio"
LangString RunText ${LANG_SERBIANLATIN} "Pokreni Kajron Atomic Studio"
LangString NeedWindows ${LANG_ENGLISH} "64-bit Windows 10 or Windows 11 is required."
LangString NeedWindows ${LANG_SERBIANLATIN} "Potreban je 64-bitni Windows 10 ili Windows 11."

Function .onInit
  !insertmacro MUI_LANGDLL_DISPLAY
  ${IfNot} ${RunningX64}
    MessageBox MB_ICONSTOP "$(NeedWindows)"
    Abort
  ${EndIf}
  ${IfNot} ${AtLeastWin10}
    MessageBox MB_ICONSTOP "$(NeedWindows)"
    Abort
  ${EndIf}
FunctionEnd

Section "Kajron Atomic Studio"
  SetShellVarContext current
  SetOutPath "$INSTDIR"
  File /r "${PAYLOAD}\*"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateDirectory "$SMPROGRAMS\Kajron Atomic Studio"
  CreateShortcut "$SMPROGRAMS\Kajron Atomic Studio\Kajron Atomic Studio.lnk" "$INSTDIR\Kajron Atomic Studio.exe" "" "$INSTDIR\resources\app\icon.ico"
  CreateShortcut "$DESKTOP\Kajron Atomic Studio.lnk" "$INSTDIR\Kajron Atomic Studio.exe" "" "$INSTDIR\resources\app\icon.ico"
  CreateShortcut "$SMPROGRAMS\Kajron Atomic Studio\Deinstaliraj.lnk" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\KajronAtomicStudio" "DisplayName" "Kajron Atomic Studio"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\KajronAtomicStudio" "DisplayVersion" "2.0.0"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\KajronAtomicStudio" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\KajronAtomicStudio" "DisplayIcon" "$INSTDIR\resources\app\icon.ico"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\KajronAtomicStudio" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\KajronAtomicStudio" "EstimatedSize" ${SIZE_KB}
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\KajronAtomicStudio" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\KajronAtomicStudio" "NoRepair" 1
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  !include "${DELETE_LIST}"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
  Delete "$DESKTOP\Kajron Atomic Studio.lnk"
  Delete "$SMPROGRAMS\Kajron Atomic Studio\Kajron Atomic Studio.lnk"
  Delete "$SMPROGRAMS\Kajron Atomic Studio\Deinstaliraj.lnk"
  RMDir "$SMPROGRAMS\Kajron Atomic Studio"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\KajronAtomicStudio"
SectionEnd
