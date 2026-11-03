# Windows packaging

The product can be run directly from source via `START_APP.bat`, but the recommended distribution is a native Windows x64 **LeadForge-Setup-1.0.0.exe** built with Go's standard library.

## Build prerequisites
- Windows with PowerShell 5.1+, Go 1.23+, Python 3+ (for test scripts), Node.js 20+ (for tests)
- This source repository checked out locally

Run: `powershell -ExecutionPolicy Bypass -File .\build_release.ps1`.

The script compiles `packaging/launcher/main.go` into `LeadForge.exe`, creates a payload ZIP of runtime files, compiles `packaging/installer/main.go` with the payload embedded, and publishes a SHA-256 manifest in `dist/`.

## Installer behavior
Per-user installation at `%LOCALAPPDATA%\Programs\LeadForge` with Desktop and Start Menu shortcuts, an Installed Apps entry, and `Uninstall LeadForge.exe`. The app serves on loopback 127.0.0.1:8765 and uses the current browser profile. Uninstall retains browser localStorage data.

**Limitations:** unsigned Windows binary; no automatic update service or code signing certificate. Existing apps using port 8765 must be closed before launch. Validate on Windows 10/11 before wide distribution.
