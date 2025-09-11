# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Electron desktop application that serves as an AI-powered neural interface with advanced multimodal capabilities. The app functions as a menu bar utility with global hotkeys for file capture, screen recording, and AI interactions using Google's Gemini AI.

## Core Architecture

### Main Process (`src/index.ts`)
- **Electron Main Process**: Handles window management, global shortcuts, IPC communication
- **MenuBar Integration**: Uses `menubar` package for system tray functionality
- **Position Memory System**: Remembers window position and size between sessions
- **WebSocket Server**: Runs on port 30010 for Chrome extension communication
- **File Processing Integration**: Coordinates with FileProcessingService for AI analysis

### Renderer Process (`src/app.tsx`)
- **React 19 Application**: Main UI rendered with React
- **LiveAPIProvider**: Manages Google Gemini AI connection context
- **ChatContainer2**: Primary chat interface component (current active version)
- **Type-Safe Preload Bridge**: Full TypeScript support for Electron APIs

### Preload Bridge (`src/preload.ts`)
- **contextBridge**: Exposes typed Electron APIs to renderer
- **Type Safety**: All APIs defined in `src/types/electron-api.ts`
- **IPC Handlers**: Window management, file processing, hotkey events

### File Processing Service (`src/services/file-processing/index.ts`)
- **Multimodal Processing**: Handles images, text, PDFs, audio, video files
- **Gemini AI Integration**: Uploads files to Google AI for analysis
- **Content Generation**: Creates summaries, transcripts, descriptions
- **Status Management**: Tracks processing states with persistent JSON files
- **Directory Structure**: Organizes processed content in `~/.neutralbase/`

## Key Features

### Global Hotkeys
- **Cmd+Shift+X / Ctrl+Shift+X**: Capture selected files from system file explorer
- **Cmd+Shift+N / Ctrl+Shift+N**: Toggle main window visibility
- **Cmd+Shift+A / Ctrl+Shift+A**: Toggle audio recording
- **Cmd+Shift+S / Ctrl+Shift+S**: Toggle screen recording

### Window Management
- **Smart Positioning**: Remembers user-dragged positions, defaults to bottom-center
- **Always On Top**: Stays above fullscreen apps on macOS
- **Resizable Interface**: Dynamic sizing based on content
- **ESC Key Hide**: Hide window with escape key

### File Processing Pipeline
1. **File Detection**: Supports images, text, PDFs, audio, video
2. **Gemini Upload**: Secure upload to Google AI services  
3. **AI Analysis**: Generates summaries, transcripts, descriptions
4. **Content Storage**: Saves processed content locally
5. **Context Integration**: Makes files available for AI conversations

### Media Recording
- **Audio Capture**: Records user audio with timestamp synchronization
- **Screen Recording**: Captures video frames for screen sessions
- **Timeline Stitching**: Intelligent audio/video synchronization
- **Final Output**: Merges all streams into complete recordings

## Development Commands

### Essential Commands
- `npm start` - Start development with Vite hot reload
- `npm run lint` - Run ESLint code quality checks  
- `npm run package` - Package app for current platform
- `npm run make` - Create distributables for all platforms

### Build System
- **Vite**: Uses Vite for fast development and optimized production builds
- **Electron Forge**: Handles packaging and distribution with Vite plugin
- **Hot Reload**: Development server provides instant updates for renderer process

### No Test Suite
This project does not include automated tests. Manual testing through the Electron development environment.

## Environment Setup

### Required Environment Variables
Create a `.env` file in the root directory:
```env
GEMINI_API_KEY=your_google_ai_api_key_here
# OR
GOOGLE_AI_API_KEY=your_google_ai_api_key_here
```

### Development Dependencies
- Node.js 18+
- Valid Google AI API key from Google AI Studio

## File Structure Patterns

### Component Architecture
- **ChatContainer2**: Active chat interface (replaces ChatContainer)
- **shadcn Components**: Reusable UI components in `src/components/shadcn/`
- **Gemini Integration**: Real-time AI conversation handling in `src/gemin/`

### Service Layer
- **FileProcessingService**: Singleton service for AI file analysis
- **External Processors**: YouTube and webpage content handling
- **Media Services**: Audio/video processing and timeline management

### Type System
- **ElectronAPI**: Complete type definitions for preload bridge
- **FileProcessingStatus**: Status tracking for processed files
- **PageData**: Web content structure for browser extension integration

## External Integrations

### Chrome Extension Communication
- WebSocket connection on localhost:30010
- Receives YouTube video data and webpage content
- Processes browser tabs for AI context

### File System Integration
- **Base Directory**: `~/.neutralbase/` for all processed content
- **File Organization**: Each processed file gets unique directory by MD5 hash
- **Status Persistence**: JSON files track processing state

## Platform Support

### Cross-Platform Compatibility
- **macOS**: Full feature support with system integration
- **Windows**: PowerShell automation for file selection
- **Linux**: Basic support with clipboard fallback

### Build Targets
- **macOS**: DMG and ZIP distributions
- **Windows**: Squirrel installer
- **Linux**: DEB and RPM packages

## Important Notes

### Security Considerations
- API keys loaded from environment variables only
- Content Security Policy configured for safe operation
- File uploads handled through secure Gemini AI endpoints

### Performance Characteristics
- **Parallel Processing**: Multiple files processed simultaneously
- **Memory Management**: Large files uploaded to Gemini rather than kept in memory
- **Cleanup**: Temporary Gemini files deleted after processing
- **Timeline Optimization**: Intelligent audio/video synchronization reduces processing time

### Debugging
- Comprehensive console logging with prefixed categories
- Status files provide processing state visibility
- WebSocket connection monitoring for extension communication