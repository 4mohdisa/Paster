// S3 Component - Minimal & Humanised UI with Comprehensive Logging
const { app, BrowserWindow, ipcMain } = require('electron');

if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

let mainWindow;
const logs = []; // Store all logs

// Logging function
function addLog(level, category, message, data = null) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        level, // info, success, warning, error, debug
        category, // system, ui, api, user, ipc, state
        message,
        data
    };
    logs.push(logEntry);

    // Send to renderer if window exists
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('new-log', logEntry);
    }

    // Also log to console
    const emoji = {
        info: 'ℹ️',
        success: '✅',
        warning: '⚠️',
        error: '❌',
        debug: '🔍'
    };
    console.log(`${emoji[level] || '📝'} [${category}] ${message}`, data || '');
}

function createWindow() {
  addLog('info', 'system', 'Initializing application window');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    title: 'S3 Component',
    backgroundColor: '#fafafa',
    show: false
  });

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>S3 Component</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', system-ui, sans-serif;
            background: #fafafa;
            color: #1a1a1a;
            height: 100vh;
            overflow: hidden;
        }

        .app-container {
            display: grid;
            grid-template-columns: 260px 1fr;
            height: 100vh;
        }

        /* Sidebar */
        .sidebar {
            background: #ffffff;
            border-right: 1px solid #e5e5e5;
            padding: 28px 20px;
            display: flex;
            flex-direction: column;
        }

        .logo {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 36px;
            color: #000000;
            cursor: pointer;
            user-select: none;
            letter-spacing: -0.3px;
        }

        .logo span {
            color: #666666;
            font-weight: 700;
        }

        .stats-section {
            margin-bottom: auto;
        }

        .stats-card {
            background: #f5f5f5;
            border-radius: 16px;
            padding: 18px;
            margin-bottom: 14px;
            transition: all 0.3s ease;
            border: 1px solid #e5e5e5;
        }

        .stats-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
            border-color: #d5d5d5;
        }

        .stat-label {
            font-size: 12px;
            color: #666666;
            margin-bottom: 6px;
            font-weight: 500;
        }

        .stat-value {
            font-size: 28px;
            font-weight: 700;
            color: #000000;
            line-height: 1;
        }

        .action-buttons {
            padding-top: 20px;
            border-top: 1px solid rgba(0, 0, 0, 0.06);
        }

        button {
            width: 100%;
            background: #000000;
            color: white;
            border: none;
            padding: 14px 20px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            margin-bottom: 10px;
        }

        button:hover {
            transform: translateY(-2px);
            background: #1a1a1a;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
        }

        button.secondary {
            background: #f5f5f5;
            color: #000000;
            border: 1px solid #e5e5e5;
        }

        button.secondary:hover {
            background: #e5e5e5;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        /* Main Content */
        .main-content {
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .header {
            background: #ffffff;
            border-bottom: 1px solid #e5e5e5;
            padding: 24px 36px;
        }

        .header h1 {
            font-size: 24px;
            font-weight: 700;
            color: #000000;
            margin-bottom: 6px;
            letter-spacing: -0.5px;
        }

        .header-subtitle {
            font-size: 14px;
            color: #666666;
        }

        .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px 14px;
            background: #f5f5f5;
            color: #1a1a1a;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            margin-top: 8px;
            border: 1px solid #e5e5e5;
        }

        .status-dot {
            width: 6px;
            height: 6px;
            background: #000000;
            border-radius: 50%;
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.6; transform: scale(0.9); }
        }

        .content-area {
            flex: 1;
            overflow-y: auto;
            padding: 36px;
        }

        .section {
            background: #ffffff;
            border-radius: 20px;
            padding: 28px;
            margin-bottom: 24px;
            border: 1px solid #e5e5e5;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
        }

        .section-title {
            font-size: 18px;
            font-weight: 700;
            color: #000000;
            margin-bottom: 20px;
        }

        /* Upload Area */
        .upload-area {
            border: 2px dashed #d5d5d5;
            border-radius: 16px;
            padding: 50px;
            text-align: center;
            transition: all 0.3s ease;
            cursor: pointer;
            background: #fafafa;
        }

        .upload-area:hover {
            border-color: #999999;
            background: #f5f5f5;
            transform: translateY(-2px);
        }

        .upload-area.dragging {
            border-color: #000000;
            background: #f0f0f0;
            transform: scale(1.02);
        }

        .upload-icon {
            font-size: 52px;
            margin-bottom: 18px;
            filter: grayscale(1);
            opacity: 0.6;
        }

        .upload-text {
            font-size: 17px;
            font-weight: 600;
            color: #000000;
            margin-bottom: 8px;
        }

        .upload-hint {
            font-size: 13px;
            color: #666666;
            line-height: 1.6;
        }

        /* Progress Bar */
        .progress-container {
            margin-top: 24px;
            display: none;
        }

        .progress-bar {
            width: 100%;
            height: 8px;
            background: #e5e5e5;
            border-radius: 10px;
            overflow: hidden;
        }

        .progress-fill {
            height: 100%;
            background: #000000;
            width: 0%;
            transition: width 0.5s ease;
            border-radius: 10px;
        }

        .progress-text {
            margin-top: 12px;
            font-size: 13px;
            color: #666666;
            text-align: center;
        }

        /* File List */
        .search-bar {
            width: 100%;
            padding: 12px 18px;
            border: 1px solid #e5e5e5;
            border-radius: 12px;
            font-size: 14px;
            margin-bottom: 20px;
            background: #fafafa;
            transition: all 0.2s ease;
        }

        .search-bar:focus {
            outline: none;
            border-color: #999999;
            background: white;
            box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.05);
        }

        .file-list {
            display: grid;
            gap: 12px;
        }

        .file-item {
            display: grid;
            grid-template-columns: 44px 1fr auto auto;
            gap: 16px;
            align-items: center;
            padding: 16px;
            background: #fafafa;
            border-radius: 14px;
            transition: all 0.3s ease;
            border: 1px solid #e5e5e5;
        }

        .file-item:hover {
            background: #f5f5f5;
            transform: translateX(6px);
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
            border-color: #d5d5d5;
        }

        .file-icon {
            width: 44px;
            height: 44px;
            background: #000000;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22px;
        }

        .file-info {
            flex: 1;
        }

        .file-name {
            font-size: 14px;
            font-weight: 600;
            color: #000000;
            margin-bottom: 4px;
        }

        .file-meta {
            font-size: 12px;
            color: #999999;
        }

        .storage-badge {
            padding: 5px 12px;
            border-radius: 8px;
            font-size: 11px;
            font-weight: 600;
            text-transform: capitalize;
        }

        .storage-badge.local {
            background: #e5e5e5;
            color: #1a1a1a;
            border: 1px solid #d5d5d5;
        }

        .storage-badge.cloud {
            background: #f5f5f5;
            color: #666666;
            border: 1px solid #e5e5e5;
        }

        .file-actions {
            display: flex;
            gap: 8px;
        }

        .icon-btn {
            width: 36px;
            height: 36px;
            padding: 0;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f5f5f5;
            color: #666666;
            margin: 0;
            font-size: 16px;
            border: 1px solid #e5e5e5;
        }

        .icon-btn:hover {
            background: #000000;
            color: white;
            border-color: #000000;
        }

        /* Empty State */
        .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: #999999;
        }

        .empty-icon {
            font-size: 56px;
            margin-bottom: 16px;
            opacity: 0.4;
            filter: grayscale(1);
        }

        /* Logs Screen */
        .logs-screen {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.95);
            z-index: 9999;
            display: none;
            flex-direction: column;
        }

        .logs-screen.visible {
            display: flex;
        }

        .logs-header {
            background: rgba(255, 255, 255, 0.05);
            padding: 20px 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .logs-title {
            font-size: 18px;
            font-weight: 700;
            color: white;
        }

        .logs-controls {
            display: flex;
            gap: 10px;
        }

        .logs-controls button {
            width: auto;
            padding: 8px 16px;
            font-size: 12px;
            margin: 0;
        }

        .logs-filters {
            background: rgba(255, 255, 255, 0.03);
            padding: 12px 24px;
            display: flex;
            gap: 10px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            flex-wrap: wrap;
        }

        .filter-btn {
            padding: 6px 14px;
            border-radius: 8px;
            font-size: 11px;
            font-weight: 600;
            background: rgba(255, 255, 255, 0.1);
            color: rgba(255, 255, 255, 0.7);
            border: 1px solid rgba(255, 255, 255, 0.1);
            cursor: pointer;
            transition: all 0.2s ease;
            margin: 0;
            width: auto;
        }

        .filter-btn.active {
            background: #000000;
            color: white;
            border-color: #000000;
        }

        .logs-content {
            flex: 1;
            overflow-y: auto;
            padding: 16px 24px;
            font-family: 'SF Mono', Monaco, 'Courier New', monospace;
            font-size: 12px;
        }

        .log-entry {
            display: grid;
            grid-template-columns: 140px 60px 80px 1fr;
            gap: 12px;
            padding: 10px;
            margin-bottom: 4px;
            border-radius: 6px;
            background: rgba(255, 255, 255, 0.02);
            border-left: 3px solid transparent;
        }

        .log-entry:hover {
            background: rgba(255, 255, 255, 0.05);
        }

        .log-entry.info { border-left-color: #3b82f6; }
        .log-entry.success { border-left-color: #10b981; }
        .log-entry.warning { border-left-color: #f59e0b; }
        .log-entry.error { border-left-color: #ef4444; }
        .log-entry.debug { border-left-color: #8b5cf6; }

        .log-time {
            color: #6b7280;
            font-size: 11px;
        }

        .log-level {
            font-weight: 700;
            text-transform: uppercase;
            font-size: 10px;
        }

        .log-level.info { color: #3b82f6; }
        .log-level.success { color: #10b981; }
        .log-level.warning { color: #f59e0b; }
        .log-level.error { color: #ef4444; }
        .log-level.debug { color: #8b5cf6; }

        .log-category {
            color: #9ca3af;
            font-size: 11px;
        }

        .log-message {
            color: #d1d5db;
        }

        .log-data {
            grid-column: 4;
            color: #6b7280;
            font-size: 11px;
            margin-top: 4px;
            padding-left: 12px;
            border-left: 2px solid rgba(255, 255, 255, 0.1);
        }

        input[type="file"] {
            display: none;
        }

        /* Scrollbar */
        ::-webkit-scrollbar {
            width: 10px;
        }

        ::-webkit-scrollbar-track {
            background: #f5f5f5;
            border-radius: 10px;
        }

        ::-webkit-scrollbar-thumb {
            background: #d5d5d5;
            border-radius: 10px;
        }

        ::-webkit-scrollbar-thumb:hover {
            background: #999999;
        }

        /* File Details Modal */
        .file-details-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 10000;
            display: none;
            align-items: center;
            justify-content: center;
        }

        .file-details-modal.visible {
            display: flex;
        }

        .modal-backdrop {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            cursor: pointer;
        }

        .modal-content {
            position: relative;
            background: #ffffff;
            border-radius: 12px;
            width: 90%;
            max-width: 600px;
            max-height: 80vh;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            display: flex;
            flex-direction: column;
            z-index: 1;
        }

        .modal-header {
            padding: 24px;
            border-bottom: 1px solid #e5e5e5;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .modal-title {
            font-size: 20px;
            font-weight: 700;
            color: #000000;
        }

        .modal-close {
            background: none;
            border: none;
            font-size: 32px;
            color: #666666;
            cursor: pointer;
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 6px;
            transition: all 0.2s;
            padding: 0;
            line-height: 1;
        }

        .modal-close:hover {
            background: #f5f5f5;
            color: #000000;
        }

        .modal-body {
            flex: 1;
            overflow-y: auto;
            padding: 24px;
        }

        .detail-row {
            display: flex;
            padding: 16px 0;
            border-bottom: 1px solid #f5f5f5;
        }

        .detail-row:last-child {
            border-bottom: none;
        }

        .detail-label {
            font-weight: 600;
            color: #000000;
            width: 140px;
            flex-shrink: 0;
        }

        .detail-value {
            color: #666666;
            flex: 1;
            word-break: break-all;
            font-family: 'SF Mono', Monaco, 'Courier New', monospace;
            font-size: 13px;
        }

        .detail-value.highlight {
            background: #f5f5f5;
            padding: 4px 8px;
            border-radius: 4px;
        }

        .file-item {
            cursor: pointer;
        }

        .file-item:hover {
            background: #fafafa;
        }
    </style>
</head>
<body>
    <!-- Logs Screen (Hidden by default) -->
    <div class="logs-screen" id="logsScreen">
        <div class="logs-header">
            <div class="logs-title">📋 System Logs</div>
            <div class="logs-controls">
                <button onclick="exportLogs()">💾 Export</button>
                <button onclick="clearLogs()" class="secondary">🗑️ Clear</button>
                <button onclick="toggleLogs()" class="secondary">✕ Close</button>
            </div>
        </div>
        <div class="logs-filters">
            <button class="filter-btn active" data-filter="all" onclick="filterLogs('all')">All</button>
            <button class="filter-btn" data-filter="info" onclick="filterLogs('info')">Info</button>
            <button class="filter-btn" data-filter="success" onclick="filterLogs('success')">Success</button>
            <button class="filter-btn" data-filter="warning" onclick="filterLogs('warning')">Warning</button>
            <button class="filter-btn" data-filter="error" onclick="filterLogs('error')">Error</button>
            <button class="filter-btn" data-filter="debug" onclick="filterLogs('debug')">Debug</button>
            <div style="margin-left: auto; color: #9ca3af; font-size: 11px; display: flex; align-items: center;">
                <span id="logCount">0 logs</span>
            </div>
        </div>
        <div class="logs-content" id="logsContent">
            <div style="color: #6b7280; text-align: center; padding: 40px;">
                Waiting for logs...
            </div>
        </div>
    </div>

    <!-- Main App -->
    <div class="app-container">
        <!-- Sidebar -->
        <div class="sidebar">
            <div class="logo" id="logo" onclick="handleLogoClick()">
                <span>S3</span> Component
            </div>

            <div class="stats-section">
                <div class="stats-card">
                    <div class="stat-label">Your files</div>
                    <div class="stat-value" id="totalFiles">0</div>
                </div>

                <div class="stats-card">
                    <div class="stat-label">On this device</div>
                    <div class="stat-value" id="localFiles">0</div>
                </div>

                <div class="stats-card">
                    <div class="stat-label">In the cloud</div>
                    <div class="stat-value" id="cloudFiles">0</div>
                </div>
            </div>

            <div class="action-buttons">
                <button onclick="triggerUpload()">Upload something</button>
                <button class="secondary" onclick="refreshAll()">Refresh</button>
                <button class="secondary" onclick="toggleLogs()">📋 View Logs</button>
            </div>
        </div>

        <!-- Main Content -->
        <div class="main-content">
            <div class="header">
                <h1>Your storage space</h1>
                <div class="header-subtitle">Everything you've uploaded, right here</div>
                <div class="status-badge">
                    <div class="status-dot"></div>
                    All systems running smoothly
                </div>
            </div>

            <div class="content-area">
                <!-- Upload Section -->
                <div class="section">
                    <div class="upload-area" onclick="triggerUpload()" id="uploadArea">
                        <div class="upload-icon">☁️</div>
                        <div class="upload-text">Drop your files here, or click to browse</div>
                        <div class="upload-hint">We'll store small files on your device and bigger ones in the cloud.<br>It's automatic, so you don't have to think about it.</div>
                    </div>
                    <div class="progress-container" id="progressContainer">
                        <div class="progress-bar">
                            <div class="progress-fill" id="progressFill"></div>
                        </div>
                        <div class="progress-text" id="progressText">Working on it...</div>
                    </div>
                </div>

                <!-- Files Section -->
                <div class="section">
                    <div class="section-title">Recent uploads</div>
                    <input type="text" class="search-bar" id="searchBar" placeholder="Search your files..." onkeyup="filterFiles()">
                    <div class="file-list" id="fileList">
                        <div class="empty-state">
                            <div class="empty-icon">📂</div>
                            <div>Nothing here yet. Upload something to get started!</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <input type="file" id="fileInput" onchange="handleFileUpload(this.files[0])" />

    <!-- File Details Modal -->
    <div id="fileDetailsModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center;">
        <div style="background: white; border-radius: 12px; padding: 24px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #f0f0f0; padding-bottom: 12px;">
                <h2 style="margin: 0; color: #333; font-size: 20px;">File Details</h2>
                <button id="closeDetailsModal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666; padding: 0; width: 32px; height: 32px; border-radius: 50%; transition: background 0.2s;">&times;</button>
            </div>

            <div style="display: grid; gap: 16px;">
                <div>
                    <div style="color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">File Name</div>
                    <div id="detailFileName" style="color: #333; font-size: 16px; font-weight: 500; word-break: break-all;"></div>
                </div>

                <div>
                    <div style="color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Object Key</div>
                    <div id="detailObjectKey" style="color: #333; font-size: 14px; font-family: monospace; background: #f5f5f5; padding: 8px; border-radius: 4px; word-break: break-all;"></div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div>
                        <div style="color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">File Size</div>
                        <div id="detailFileSize" style="color: #333; font-size: 14px;"></div>
                    </div>

                    <div>
                        <div style="color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Storage Type</div>
                        <div id="detailStorageType" style="color: #333; font-size: 14px; text-transform: capitalize;"></div>
                    </div>
                </div>

                <div>
                    <div style="color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">MIME Type</div>
                    <div id="detailMimeType" style="color: #333; font-size: 14px; font-family: monospace; background: #f5f5f5; padding: 8px; border-radius: 4px;"></div>
                </div>

                <div>
                    <div style="color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Upload Time</div>
                    <div id="detailTimestamp" style="color: #333; font-size: 14px;"></div>
                </div>

                <div>
                    <div style="color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Database ID</div>
                    <div id="detailId" style="color: #333; font-size: 12px; font-family: monospace; background: #f5f5f5; padding: 8px; border-radius: 4px; word-break: break-all;"></div>
                </div>
            </div>
        </div>
    </div>

    <script>
        console.log('🔥 SCRIPT TAG EXECUTING 🔥');
        const { ipcRenderer } = require('electron');
        console.log('🔥 ipcRenderer loaded:', !!ipcRenderer);
        let allFiles = [];
        let allLogs = [];
        let currentLogFilter = 'all';
        let logoClickCount = 0;
        let logoClickTimeout = null;

        // Client-side logging
        function log(level, category, message, data = null) {
            const logEntry = {
                timestamp: new Date().toISOString(),
                level,
                category,
                message,
                data
            };
            allLogs.push(logEntry);

            // Display in logs screen if visible and matches filter
            if (document.getElementById('logsScreen').classList.contains('visible')) {
                if (currentLogFilter === 'all' || currentLogFilter === level) {
                    addLogToDisplay(logEntry);
                }
            }

            updateLogCount();
        }

        function addLogToDisplay(logEntry) {
            const logsContent = document.getElementById('logsContent');
            const time = new Date(logEntry.timestamp).toLocaleTimeString();

            const logElement = document.createElement('div');
            logElement.className = 'log-entry ' + logEntry.level;
            logElement.innerHTML = '<div class="log-time">' + time + '</div>' +
                '<div class="log-level ' + logEntry.level + '">' + logEntry.level + '</div>' +
                '<div class="log-category">' + logEntry.category + '</div>' +
                '<div class="log-message">' + logEntry.message + '</div>' +
                (logEntry.data ? '<div class="log-data">' + JSON.stringify(logEntry.data, null, 2) + '</div>' : '');

            if (logsContent.children[0]?.textContent.includes('Waiting for logs')) {
                logsContent.innerHTML = '';
            }

            logsContent.appendChild(logElement);
            logsContent.scrollTop = logsContent.scrollHeight;
        }

        function updateLogCount() {
            document.getElementById('logCount').textContent = allLogs.length + ' logs';
        }

        // Listen for logs from main process
        ipcRenderer.on('new-log', (event, logEntry) => {
            allLogs.push(logEntry);
            if (document.getElementById('logsScreen').classList.contains('visible')) {
                if (currentLogFilter === 'all' || currentLogFilter === logEntry.level) {
                    addLogToDisplay(logEntry);
                }
            }
            updateLogCount();
        });

        // Logo click handler (3 clicks to show logs)
        function handleLogoClick() {
            log('debug', 'ui', 'Logo clicked');
            logoClickCount++;

            if (logoClickTimeout) clearTimeout(logoClickTimeout);

            if (logoClickCount >= 3) {
                toggleLogs();
                logoClickCount = 0;
            } else {
                logoClickTimeout = setTimeout(() => {
                    logoClickCount = 0;
                }, 2000);
            }
        }

        // Toggle logs screen
        function toggleLogs() {
            const logsScreen = document.getElementById('logsScreen');
            const isVisible = logsScreen.classList.toggle('visible');
            log('info', 'ui', isVisible ? 'Logs screen opened' : 'Logs screen closed');

            if (isVisible) {
                displayAllLogs();
            }
        }

        // Display all logs (optimized - show last 100 initially)
        function displayAllLogs() {
            const logsContent = document.getElementById('logsContent');
            logsContent.innerHTML = '';

            const filteredLogs = currentLogFilter === 'all'
                ? allLogs
                : allLogs.filter(log => log.level === currentLogFilter);

            // Show only last 100 logs for performance, user can scroll to load more
            const logsToShow = filteredLogs.slice(-100);

            logsToShow.forEach(logEntry => {
                addLogToDisplay(logEntry);
            });

            // Show info if there are more logs
            if (filteredLogs.length > 100) {
                const infoDiv = document.createElement('div');
                infoDiv.style.cssText = 'color: #9ca3af; text-align: center; padding: 12px; font-size: 12px;';
                infoDiv.textContent = 'Showing last 100 of ' + filteredLogs.length + ' logs. Scroll up to see more.';
                logsContent.insertBefore(infoDiv, logsContent.firstChild);
            }
        }

        // Filter logs
        function filterLogs(filter) {
            log('debug', 'ui', 'Filtering logs by: ' + filter);
            currentLogFilter = filter;

            // Update active filter button
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.filter === filter);
            });

            displayAllLogs();
        }

        // Export logs
        function exportLogs() {
            log('info', 'user', 'Exporting logs');
            const dataStr = JSON.stringify(allLogs, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 's3-component-logs-' + Date.now() + '.json';
            link.click();
            log('success', 'user', 'Logs exported successfully');
        }

        // Clear logs
        function clearLogs() {
            if (confirm('Are you sure you want to clear all logs?')) {
                log('warning', 'user', 'Clearing all logs');
                allLogs = [];
                document.getElementById('logsContent').innerHTML = '<div style="color: #6b7280; text-align: center; padding: 40px;">Logs cleared</div>';
                updateLogCount();
            }
        }

        // Keyboard shortcut for logs (Cmd+L or Ctrl+L)
        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
                e.preventDefault();
                toggleLogs();
            }
        });

        // Load initial data
        // Check if DOM is already loaded (since script is in body)
        console.log('🔥 document.readyState:', document.readyState);
        if (document.readyState === 'loading') {
            console.log('🔥 DOM still loading, adding event listener');
            window.addEventListener('DOMContentLoaded', initializeApp);
        } else {
            console.log('🔥 DOM already loaded, calling initializeApp immediately');
            initializeApp();
        }

        function initializeApp() {
            console.log('🔥 initializeApp() CALLED!');
            log('info', 'system', 'Application loaded');
            loadFiles();
            setupDragDrop();
            setupComprehensiveLogging();
            setupModalHandlers();
        }

        // ULTRA-COMPREHENSIVE LOGGING - Track EVERYTHING
        function setupComprehensiveLogging() {
            log('debug', 'system', 'Setting up comprehensive event logging');

            // Track every mouse click
            document.addEventListener('click', (e) => {
                log('debug', 'user', 'Mouse click', {
                    x: e.clientX,
                    y: e.clientY,
                    target: e.target.tagName,
                    targetId: e.target.id,
                    targetClass: e.target.className
                });
            });

            // Track every keypress
            document.addEventListener('keydown', (e) => {
                log('debug', 'user', 'Key pressed', {
                    key: e.key,
                    code: e.code,
                    ctrl: e.ctrlKey,
                    meta: e.metaKey,
                    shift: e.shiftKey,
                    alt: e.altKey
                });
            });

            // Track mouse movements (throttled to every 500ms)
            let lastMouseLog = 0;
            document.addEventListener('mousemove', (e) => {
                const now = Date.now();
                if (now - lastMouseLog > 500) {
                    log('debug', 'user', 'Mouse movement', {
                        x: e.clientX,
                        y: e.clientY
                    });
                    lastMouseLog = now;
                }
            });

            // Track scroll events
            let lastScrollLog = 0;
            document.addEventListener('scroll', (e) => {
                const now = Date.now();
                if (now - lastScrollLog > 500) {
                    log('debug', 'ui', 'Scroll event', {
                        scrollTop: e.target.scrollTop,
                        scrollLeft: e.target.scrollLeft
                    });
                    lastScrollLog = now;
                }
            }, true);

            // Track window resize
            let lastResizeLog = 0;
            window.addEventListener('resize', () => {
                const now = Date.now();
                if (now - lastResizeLog > 500) {
                    log('debug', 'system', 'Window resized', {
                        width: window.innerWidth,
                        height: window.innerHeight
                    });
                    lastResizeLog = now;
                }
            });

            // Intercept fetch calls to log all network requests
            const originalFetch = window.fetch;
            window.fetch = async function(...args) {
                const url = args[0];
                const options = args[1] || {};

                // Safely log body without parsing (avoid ArrayBuffer issues)
                let bodyInfo = null;
                if (options.body) {
                    if (typeof options.body === 'string') {
                        bodyInfo = 'JSON string (' + options.body.length + ' bytes)';
                    } else if (options.body instanceof ArrayBuffer) {
                        bodyInfo = 'ArrayBuffer (' + options.body.byteLength + ' bytes)';
                    } else {
                        bodyInfo = options.body.constructor.name;
                    }
                }

                log('debug', 'api', 'Network request initiated', {
                    url,
                    method: options.method || 'GET',
                    bodyType: bodyInfo
                });

                try {
                    const response = await originalFetch.apply(this, args);
                    log('success', 'api', 'Network request successful', {
                        url,
                        status: response.status,
                        statusText: response.statusText
                    });
                    return response;
                } catch (error) {
                    log('error', 'api', 'Network request failed', {
                        url,
                        error: error.message
                    });
                    throw error;
                }
            };

            // Track console logs
            const originalConsoleLog = console.log;
            console.log = function(...args) {
                log('debug', 'system', 'Console log', { message: args.join(' ') });
                originalConsoleLog.apply(console, args);
            };

            const originalConsoleError = console.error;
            console.error = function(...args) {
                log('error', 'system', 'Console error', { message: args.join(' ') });
                originalConsoleError.apply(console, args);
            };

            const originalConsoleWarn = console.warn;
            console.warn = function(...args) {
                log('warning', 'system', 'Console warning', { message: args.join(' ') });
                originalConsoleWarn.apply(console, args);
            };

            // Track unhandled errors
            window.addEventListener('error', (e) => {
                log('error', 'system', 'Unhandled error', {
                    message: e.message,
                    filename: e.filename,
                    lineno: e.lineno,
                    colno: e.colno
                });
            });

            // Track unhandled promise rejections
            window.addEventListener('unhandledrejection', (e) => {
                log('error', 'system', 'Unhandled promise rejection', {
                    reason: e.reason
                });
            });

            // Track visibility changes
            document.addEventListener('visibilitychange', () => {
                log('debug', 'system', 'Visibility changed', {
                    hidden: document.hidden
                });
            });

            // Track online/offline
            window.addEventListener('online', () => {
                log('info', 'system', 'Connection online');
            });

            window.addEventListener('offline', () => {
                log('warning', 'system', 'Connection offline');
            });

            // Performance monitoring (every 5 seconds)
            setInterval(() => {
                if (performance.memory) {
                    log('debug', 'state', 'Performance metrics', {
                        memory: {
                            usedJSHeapSize: Math.round(performance.memory.usedJSHeapSize / 1048576) + ' MB',
                            totalJSHeapSize: Math.round(performance.memory.totalJSHeapSize / 1048576) + ' MB',
                            jsHeapSizeLimit: Math.round(performance.memory.jsHeapSizeLimit / 1048576) + ' MB'
                        },
                        navigation: {
                            loadTime: Math.round(performance.timing.loadEventEnd - performance.timing.navigationStart) + ' ms'
                        }
                    });
                }
            }, 5000);

            // Track input changes
            document.addEventListener('input', (e) => {
                if (e.target.type === 'file') return; // Skip file inputs for security
                log('debug', 'user', 'Input changed', {
                    targetId: e.target.id,
                    value: e.target.value?.substring(0, 50) + (e.target.value?.length > 50 ? '...' : '')
                });
            });

            // Track focus changes
            document.addEventListener('focusin', (e) => {
                log('debug', 'ui', 'Element focused', {
                    target: e.target.tagName,
                    targetId: e.target.id
                });
            });

            document.addEventListener('focusout', (e) => {
                log('debug', 'ui', 'Element blurred', {
                    target: e.target.tagName,
                    targetId: e.target.id
                });
            });

            log('success', 'system', 'Comprehensive logging system initialized');
        }

        function setupModalHandlers() {
            log('debug', 'system', 'Setting up modal event handlers');

            // Close modal on backdrop click
            const modal = document.getElementById('fileDetailsModal');
            if (modal) {
                modal.addEventListener('click', (e) => {
                    if (e.target.id === 'fileDetailsModal') {
                        modal.style.display = 'none';
                        log('debug', 'user', 'File details modal closed (backdrop click)');
                    }
                });
            }

            // Close modal on close button click
            const closeButton = document.getElementById('closeDetailsModal');
            if (closeButton) {
                closeButton.addEventListener('click', () => {
                    modal.style.display = 'none';
                    log('debug', 'user', 'File details modal closed (close button)');
                });
            }

            log('success', 'system', 'Modal handlers initialized');
        }

        function setupDragDrop() {
            const uploadArea = document.getElementById('uploadArea');
            log('debug', 'system', 'Setting up drag and drop');

            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('dragging');
                log('debug', 'ui', 'File drag over upload area');
            });

            uploadArea.addEventListener('dragleave', () => {
                uploadArea.classList.remove('dragging');
                log('debug', 'ui', 'File drag left upload area');
            });

            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('dragging');
                if (e.dataTransfer.files.length > 0) {
                    log('info', 'user', 'File dropped', { fileName: e.dataTransfer.files[0].name });
                    handleFileUpload(e.dataTransfer.files[0]);
                }
            });
        }

        function triggerUpload() {
            log('info', 'user', 'Upload button clicked');
            document.getElementById('fileInput').click();
        }

        async function handleFileUpload(file) {
            if (!file) {
                log('warning', 'user', 'No file selected');
                return;
            }

            log('info', 'user', 'File upload started', {
                fileName: file.name,
                fileSize: file.size,
                mimeType: file.type
            });

            const progressContainer = document.getElementById('progressContainer');
            const progressFill = document.getElementById('progressFill');
            const progressText = document.getElementById('progressText');

            try {
                progressContainer.style.display = 'block';
                progressFill.style.width = '10%';
                progressText.textContent = 'Preparing your file...';
                log('debug', 'state', 'Progress: 10% - Preparing upload');

                // Determine storage type
                const storageType = file.size > 5 * 1024 * 1024 ? 'cloud' : 'local';
                log('info', 'system', 'Storage type determined: ' + storageType, { fileSize: file.size });

                // Step 1: Get S3 upload URL
                log('debug', 'api', 'Requesting S3 upload URL');
                const s3Response = await fetch('http://localhost:9000/api/s3/generate-upload-url', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        filePath: '/uploads/' + file.name,
                        storageType,
                        fileName: file.name,
                        contentType: file.type || 'application/octet-stream'
                    })
                });

                let s3Result;
                try {
                    s3Result = await s3Response.json();
                } catch (jsonError) {
                    log('error', 'api', 'Failed to parse S3 response as JSON', {
                        error: jsonError.message,
                        status: s3Response.status,
                        contentType: s3Response.headers.get('content-type')
                    });
                    throw new Error('Invalid response from S3 service: ' + jsonError.message);
                }

                log('success', 'api', 'S3 upload URL received', { objectKey: s3Result.objectKey });

                if (!s3Result.success) {
                    throw new Error('S3 upload failed');
                }

                progressFill.style.width = '40%';
                progressText.textContent = 'Uploading to storage...';
                log('debug', 'state', 'Progress: 40% - Uploading');

                // Step 2: Upload actual file content to S3
                log('debug', 'api', 'Uploading file content to S3', { url: s3Result.signedUrl });
                const fileContent = await file.arrayBuffer();
                const uploadResponse = await fetch(s3Result.signedUrl, {
                    method: 'PUT',
                    body: fileContent,
                    headers: {
                        'Content-Type': file.type || 'application/octet-stream'
                    }
                });

                if (!uploadResponse.ok) {
                    throw new Error('Failed to upload file to S3: ' + uploadResponse.status);
                }

                log('success', 'api', 'File uploaded to S3', {
                    objectKey: s3Result.objectKey,
                    fileSize: file.size
                });

                progressFill.style.width = '70%';
                progressText.textContent = 'Saving to database...';
                log('debug', 'state', 'Progress: 70% - Saving to database');

                // Step 2: Store in Convex
                log('debug', 'ipc', 'Requesting Convex storage via IPC');
                const convexResult = await ipcRenderer.invoke('storeViaHttp', {
                    objectKey: s3Result.objectKey,
                    fileName: file.name,
                    fileSize: file.size,
                    mimeType: file.type || 'application/octet-stream',
                    storageType
                });

                log('success', 'api', 'Convex storage completed', { objectId: convexResult.objectId });

                if (!convexResult.success) {
                    throw new Error('Database save failed');
                }

                progressFill.style.width = '100%';
                progressText.textContent = '✨ All done! Your file is safe.';
                log('success', 'user', 'File upload completed successfully', { fileName: file.name });

                setTimeout(() => {
                    progressContainer.style.display = 'none';
                    progressFill.style.width = '0%';
                    loadFiles();
                }, 1500);

            } catch (error) {
                log('error', 'system', 'File upload failed', { error: error.message });
                progressText.textContent = '❌ Oops! Something went wrong: ' + error.message;
                setTimeout(() => {
                    progressContainer.style.display = 'none';
                    progressFill.style.width = '0%';
                }, 3000);
            }
        }

        async function loadFiles() {
            log('info', 'system', 'Loading files from database');
            try {
                const files = await ipcRenderer.invoke('getAllFiles');
                log('success', 'api', 'Files loaded successfully', { count: files.length });
                allFiles = files;
                displayFiles(files);
                updateStats(files);
            } catch (error) {
                log('error', 'api', 'Failed to load files', { error: error.message });
            }
        }

        function displayFiles(files) {
            log('debug', 'ui', 'Displaying files', { count: files.length });
            const fileList = document.getElementById('fileList');

            if (files.length === 0) {
                fileList.innerHTML = '<div class="empty-state">' +
                    '<div class="empty-icon">📂</div>' +
                    '<div>Nothing here yet. Upload something to get started!</div>' +
                    '</div>';
                return;
            }

            fileList.innerHTML = files.map((file, index) => {
                const timeAgo = getTimeAgo(file.timestamp);
                const sizeFormatted = formatBytes(file.fileSize);
                const icon = getFileIcon(file.mimeType);

                return '<div class="file-item" onclick="showFileDetails(' + index + ')">' +
                    '<div class="file-icon">' + icon + '</div>' +
                    '<div class="file-info">' +
                    '<div class="file-name">' + file.fileName + '</div>' +
                    '<div class="file-meta">' + sizeFormatted + ' • ' + timeAgo + '</div>' +
                    '</div>' +
                    '<div class="storage-badge ' + file.storageType + '">' + file.storageType + '</div>' +
                    '<div class="file-actions">' +
                    '<button class="icon-btn" onclick="event.stopPropagation(); downloadFile(\\\'' + file.objectKey + '\\\')" title="Download">⬇</button>' +
                    '<button class="icon-btn" onclick="event.stopPropagation(); deleteFile(\\\'' + file._id + '\\\')" title="Delete">🗑</button>' +
                    '</div>' +
                    '</div>';
            }).join('');
        }

        function filterFiles() {
            const searchTerm = document.getElementById('searchBar').value.toLowerCase();
            log('debug', 'user', 'Searching files', { searchTerm });
            const filtered = allFiles.filter(file =>
                file.fileName.toLowerCase().includes(searchTerm)
            );
            displayFiles(filtered);
        }

        function updateStats(files) {
            const total = files.length;
            const local = files.filter(f => f.storageType === 'local').length;
            const cloud = files.filter(f => f.storageType === 'cloud').length;

            log('debug', 'state', 'Stats updated', { total, local, cloud });

            document.getElementById('totalFiles').textContent = total;
            document.getElementById('localFiles').textContent = local;
            document.getElementById('cloudFiles').textContent = cloud;
        }

        function getTimeAgo(timestamp) {
            const seconds = Math.floor((Date.now() - timestamp) / 1000);
            if (seconds < 60) return 'just now';
            if (seconds < 3600) return Math.floor(seconds / 60) + ' minutes ago';
            if (seconds < 86400) return Math.floor(seconds / 3600) + ' hours ago';
            return Math.floor(seconds / 86400) + ' days ago';
        }

        function formatBytes(bytes) {
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
            return (bytes / 1048576).toFixed(1) + ' MB';
        }

        function getFileIcon(mimeType) {
            if (mimeType.includes('pdf')) return '📄';
            if (mimeType.includes('image')) return '🖼️';
            if (mimeType.includes('video')) return '🎥';
            if (mimeType.includes('audio')) return '🎵';
            if (mimeType.includes('text')) return '📝';
            return '📎';
        }

        async function downloadFile(objectKey) {
            log('info', 'user', 'Download requested', { objectKey });

            try {
                log('debug', 'api', 'Requesting download URL from Convex', { objectKey });
                const result = await ipcRenderer.invoke('downloadFile', objectKey);

                if (result.success) {
                    log('success', 'api', 'Download URL received', {
                        objectKey,
                        fileName: result.fileName
                    });

                    // Create a temporary link and trigger download
                    const link = document.createElement('a');
                    link.href = result.downloadUrl;
                    link.download = result.fileName;
                    link.style.display = 'none';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);

                    log('success', 'user', 'Download initiated', { fileName: result.fileName });
                    alert('⬇️ Downloading: ' + result.fileName);
                } else {
                    throw new Error(result.error || 'Failed to get download URL');
                }
            } catch (error) {
                log('error', 'user', 'Download failed', { error: error.message, objectKey });
                alert('❌ Failed to download file: ' + error.message);
            }
        }

        async function deleteFile(fileId) {
            log('warning', 'user', 'Delete requested', { fileId });

            if (!confirm('Are you sure? This file will be permanently deleted from both storage and database.')) {
                log('info', 'user', 'Delete cancelled');
                return;
            }

            log('warning', 'user', 'Delete confirmed', { fileId });

            try {
                // Call IPC to delete file
                const result = await ipcRenderer.invoke('deleteFile', fileId);

                if (result.success) {
                    log('success', 'user', 'File deleted successfully', {
                        fileId,
                        fileName: result.fileName
                    });

                    // Refresh the file list
                    await loadFiles();

                    // Show success message
                    alert('✅ File "' + result.fileName + '" deleted successfully!');
                } else {
                    throw new Error(result.error || 'Delete failed');
                }
            } catch (error) {
                log('error', 'user', 'Delete failed', { error: error.message });
                alert('❌ Failed to delete file: ' + error.message);
            }
        }

        function showFileDetails(fileIndex) {
            const file = allFiles[fileIndex];
            if (!file) {
                log('error', 'user', 'File not found for details', { fileIndex });
                return;
            }

            log('info', 'user', 'File details requested', { fileName: file.fileName });

            // Populate modal fields
            document.getElementById('detailFileName').textContent = file.fileName;
            document.getElementById('detailObjectKey').textContent = file.objectKey;
            document.getElementById('detailFileSize').textContent = formatBytes(file.fileSize);
            document.getElementById('detailMimeType').textContent = file.mimeType;
            document.getElementById('detailStorageType').textContent = file.storageType;
            document.getElementById('detailTimestamp').textContent = new Date(file.timestamp).toLocaleString();
            document.getElementById('detailId').textContent = file._id;

            // Show modal
            document.getElementById('fileDetailsModal').style.display = 'flex';
        }

        function refreshAll() {
            log('info', 'user', 'Refresh requested');
            loadFiles();
        }
    </script>
</body>
</html>
`;

  // Write HTML to temp file to avoid data URI encoding issues
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  const tempHtmlPath = path.join(os.tmpdir(), 's3-component.html');

  addLog('debug', 'system', 'Writing HTML to temp file', { path: tempHtmlPath });
  fs.writeFileSync(tempHtmlPath, htmlContent, 'utf-8');

  addLog('debug', 'system', 'Loading HTML from file');
  mainWindow.loadFile(tempHtmlPath)
    .then(() => {
      addLog('success', 'system', 'HTML loaded successfully');
    })
    .catch((err) => {
      addLog('error', 'system', 'Failed to load HTML', { error: err.message });
    });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    addLog('error', 'system', 'Page failed to load', { errorCode, errorDescription });
  });

  mainWindow.webContents.on('did-finish-load', () => {
    addLog('success', 'system', 'Page finished loading');
  });

  mainWindow.once('ready-to-show', () => {
    addLog('success', 'system', 'Window shown to user');
    mainWindow.show();
    mainWindow.webContents.openDevTools(); // Open DevTools to debug
  });

  // Capture console messages from renderer
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    addLog('debug', 'renderer', `Console [${level}]: ${message}`, { line, sourceId });
  });

  mainWindow.on('closed', () => {
    addLog('info', 'system', 'Window closed');
    mainWindow = null;
  });

  // Window events logging
  mainWindow.on('focus', () => addLog('debug', 'system', 'Window focused'));
  mainWindow.on('blur', () => addLog('debug', 'system', 'Window blurred'));
  mainWindow.on('minimize', () => addLog('debug', 'system', 'Window minimized'));
  mainWindow.on('restore', () => addLog('debug', 'system', 'Window restored'));
}

// IPC Handlers with comprehensive logging
ipcMain.handle('storeViaHttp', async (event, data) => {
    addLog('info', 'ipc', 'Received storeViaHttp request', { fileName: data.fileName });

    try {
        addLog('debug', 'api', 'Sending request to Convex HTTP endpoint');
        const response = await fetch('https://beloved-skunk-37.convex.site/storeS3Metadata', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        addLog('debug', 'api', 'Received response from Convex', { status: response.status });

        if (!response.ok) {
            addLog('error', 'api', 'Convex HTTP request failed', { status: response.status });
            return { success: false, error: `HTTP ${response.status}` };
        }

        const result = await response.json();
        addLog('success', 'api', 'Convex storage successful', { objectId: result.objectId });
        return result;
    } catch (error) {
        addLog('error', 'api', 'Convex request exception', { error: error.message });
        return { success: false, error: error.message };
    }
});

ipcMain.handle('getAllFiles', async () => {
    addLog('info', 'ipc', 'Received getAllFiles request');

    try {
        const { ConvexHttpClient } = require('convex/browser');
        const { api } = require('./convex/_generated/api');

        addLog('debug', 'api', 'Connecting to Convex client');
        const client = new ConvexHttpClient('https://beloved-skunk-37.convex.cloud');

        addLog('debug', 'api', 'Querying Convex for files');
        const result = await client.query(api.s3Integration.listS3Objects, {
            limit: 50
        });

        addLog('success', 'api', 'Files retrieved from Convex', { count: result.objects?.length || 0 });
        return result.objects || [];
    } catch (error) {
        addLog('error', 'api', 'Failed to get files from Convex', { error: error.message });
        return [];
    }
});

ipcMain.handle('deleteFile', async (event, fileId) => {
    addLog('warning', 'ipc', 'Received deleteFile request', { fileId });

    try {
        const { ConvexHttpClient } = require('convex/browser');
        const { api } = require('./convex/_generated/api');

        addLog('debug', 'api', 'Connecting to Convex client for deletion');
        const client = new ConvexHttpClient('https://beloved-skunk-37.convex.cloud');

        addLog('debug', 'api', 'Calling Convex delete mutation', { fileId });
        const result = await client.mutation(api.s3Integration.deleteS3Object, {
            objectId: fileId
        });

        if (result.success) {
            addLog('success', 'api', 'File deleted from Convex', {
                fileId,
                fileName: result.fileName
            });
            return { success: true, fileName: result.fileName };
        } else {
            addLog('error', 'api', 'Delete failed', { error: result.error });
            return { success: false, error: result.error };
        }
    } catch (error) {
        addLog('error', 'api', 'Failed to delete file from Convex', { error: error.message });
        return { success: false, error: error.message };
    }
});

ipcMain.handle('downloadFile', async (event, objectKey) => {
    addLog('info', 'ipc', 'Received downloadFile request', { objectKey });

    try {
        const fetch = require('node-fetch');

        // Call S3 service directly to generate download URL
        addLog('debug', 'api', 'Calling S3 service for download URL', { objectKey });
        const response = await fetch('http://localhost:9000/api/s3/generate-download-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                objectKey: objectKey,
                storageType: 'local',
                expiresIn: 3600
            })
        });

        const result = await response.json();

        if (result.success) {
            addLog('success', 'api', 'Download URL generated', {
                objectKey,
                downloadUrl: result.signedUrl
            });
            return {
                success: true,
                downloadUrl: result.signedUrl,
                fileName: result.metadata.fileName,
                fileSize: result.metadata.fileSize
            };
        } else {
            addLog('error', 'api', 'Failed to get download URL', { error: result.error });
            return { success: false, error: result.error };
        }
    } catch (error) {
        addLog('error', 'api', 'Failed to get download URL from S3', { error: error.message });
        return { success: false, error: error.message };
    }
});

app.whenReady().then(() => {
    addLog('info', 'system', 'Electron app ready');
    createWindow();
});

app.on('window-all-closed', () => {
  addLog('info', 'system', 'All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  addLog('debug', 'system', 'App activated');
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
    addLog('warning', 'system', 'Application quitting');
});
