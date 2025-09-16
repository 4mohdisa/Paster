# Development Logging Configuration

This document explains how logging has been configured to reduce console noise during development.

## Console Log Cleanup Summary

### 1. **Electron Main Process Logs Removed**
- ❌ Python server startup/shutdown messages
- ❌ WebRTC configuration announcements
- ❌ Menu bar initialization status
- ❌ Global hotkey registration confirmations
- ❌ Window positioning updates
- ❌ WebSocket connection/disconnection notices
- ❌ File capture operation details
- ❌ Session state changes
- ❌ Interface mode toggles

### 2. **Error Logs Preserved**
- ✅ All console.error statements (34 total)
- ✅ Critical error conditions
- ✅ Permission errors
- ✅ File processing failures
- ✅ WebSocket errors
- ✅ Python server errors

### 3. **System-Level Noise Reduction**

#### Electron Security Warnings (Development Only)
- Set `ELECTRON_DISABLE_SECURITY_WARNINGS=true`
- Reduced log level from INFO (0) to ERROR (3)
- Added development-only command line switches

#### Python Server Logging
Filtered out these non-error messages:
- DeprecationWarning messages
- Virtual environment path warnings
- NSCameraUseContinuityCameraDeviceType warnings
- AVCaptureDeviceTypeExternal deprecation warnings
- Uvicorn INFO messages (startup, running, etc.)
- Pipecat startup messages
- WebRTC VERBOSE1 debug logs
- Pipecat DEBUG logs
- WebRTC connection lifecycle messages
- Transport and data channel status updates
- Session lifecycle notifications

## Environment Configuration

### .env Settings
```bash
# Set to "true" to suppress development console noise
SUPPRESS_DEV_LOGS=true
```

## Logging Behavior

### Development Mode (npm start)
- **With SUPPRESS_DEV_LOGS=true**: Minimal logging, errors only
- **With SUPPRESS_DEV_LOGS=false**: Full logging (if needed for debugging)

### Production Mode (packaged app)
- All development warnings automatically suppressed
- Only critical errors logged

## What You'll Still See

### Legitimate Errors
- Python server actual errors
- File processing failures
- Network connection issues
- Permission denied errors

### Expected Development Messages
- Initial dotenv injection message (1 line)
- Critical Electron errors
- Actual Python server errors (not info/warnings)

## Reverting Changes

If you need full logging for debugging:

1. **Temporary**: Set `SUPPRESS_DEV_LOGS=false` in .env
2. **Code-level**: Comment out the filter logic in the Python server stderr handler
3. **Electron warnings**: Remove `process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";`

## Log Level Reference

| Level | Description | What You See |
|-------|-------------|--------------|
| 0 | INFO | Everything (very verbose) |
| 1 | WARNING | Warnings and errors |
| 2 | ERROR | Errors and critical issues |
| 3 | FATAL | Only fatal errors |

Current setting: **Level 3 (ERROR)** for development