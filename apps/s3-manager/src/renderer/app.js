// S3 Manager - Renderer Process
// Uses window.api (exposed via preload.js) for IPC communication

let allFiles = [];
let allLogs = [];
let currentLogFilter = 'all';
let logoClickCount = 0;
let logoClickTimeout = null;

// --- Logging ---

function log(level, category, message, data = null) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        level,
        category,
        message,
        data
    };
    allLogs.push(logEntry);

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
    logElement.innerHTML =
        '<div class="log-time">' + time + '</div>' +
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

// --- Logo Click (3 clicks to show logs) ---

function handleLogoClick() {
    logoClickCount++;
    if (logoClickTimeout) clearTimeout(logoClickTimeout);

    if (logoClickCount >= 3) {
        toggleLogs();
        logoClickCount = 0;
    } else {
        logoClickTimeout = setTimeout(() => { logoClickCount = 0; }, 2000);
    }
}

// --- Logs Screen ---

function toggleLogs() {
    const logsScreen = document.getElementById('logsScreen');
    const isVisible = logsScreen.classList.toggle('visible');
    if (isVisible) displayAllLogs();
}

function displayAllLogs() {
    const logsContent = document.getElementById('logsContent');
    logsContent.innerHTML = '';

    const filteredLogs = currentLogFilter === 'all'
        ? allLogs
        : allLogs.filter(l => l.level === currentLogFilter);

    const logsToShow = filteredLogs.slice(-100);
    logsToShow.forEach(logEntry => addLogToDisplay(logEntry));

    if (filteredLogs.length > 100) {
        const infoDiv = document.createElement('div');
        infoDiv.style.cssText = 'color: #9ca3af; text-align: center; padding: 12px; font-size: 12px;';
        infoDiv.textContent = 'Showing last 100 of ' + filteredLogs.length + ' logs.';
        logsContent.insertBefore(infoDiv, logsContent.firstChild);
    }
}

function filterLogs(filter) {
    currentLogFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    displayAllLogs();
}

function exportLogs() {
    const dataStr = JSON.stringify(allLogs, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 's3-manager-logs-' + Date.now() + '.json';
    link.click();
    log('success', 'user', 'Logs exported');
}

function clearLogs() {
    if (confirm('Clear all logs?')) {
        allLogs = [];
        document.getElementById('logsContent').innerHTML =
            '<div style="color: #6b7280; text-align: center; padding: 40px;">Logs cleared</div>';
        updateLogCount();
    }
}

// --- Keyboard Shortcuts ---

document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
        e.preventDefault();
        toggleLogs();
    }
});

// --- Initialize ---

function initializeApp() {
    log('info', 'system', 'Application loaded');
    checkCloudStorageStatus();
    loadFiles();
    setupDragDrop();
    setupModalHandlers();
}

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// --- Cloud Storage Status ---

async function checkCloudStorageStatus() {
    try {
        const status = await window.api.getCloudStorageStatus();
        if (status.enabled) {
            log('success', 'config', 'Cloud Storage: ENABLED', {
                provider: status.provider,
                bucket: status.bucketName,
                threshold: status.thresholdMB + ' MB'
            });
        } else {
            log('info', 'config', 'Cloud Storage: DISABLED - ' + status.reason);
        }
    } catch (error) {
        log('error', 'config', 'Failed to check cloud storage', { error: error.message });
    }
}

// --- Drag & Drop ---

function setupDragDrop() {
    const uploadArea = document.getElementById('uploadArea');

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragging');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragging');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragging');
        if (e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    });
}

// --- Modal ---

function setupModalHandlers() {
    const modal = document.getElementById('fileDetailsModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target.id === 'fileDetailsModal') {
                modal.style.display = 'none';
            }
        });
    }

    const closeButton = document.getElementById('closeDetailsModal');
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }
}

// --- File Upload ---

function triggerUpload() {
    document.getElementById('fileInput').click();
}

async function handleFileUpload(file) {
    if (!file) return;

    log('info', 'user', 'Upload started', { fileName: file.name, fileSize: file.size });

    const progressContainer = document.getElementById('progressContainer');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');

    try {
        progressContainer.style.display = 'block';
        progressFill.style.width = '10%';
        progressText.textContent = 'Preparing your file...';

        const storageType = file.size > 5 * 1024 * 1024 ? 'cloud' : 'local';
        log('info', 'system', 'Storage type: ' + storageType);

        // Get S3 upload URL
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

        const s3Result = await s3Response.json();
        if (!s3Result.success) {
            throw new Error('S3 upload failed: ' + (s3Result.error || 'Unknown error'));
        }

        log('success', 'api', 'Upload URL received', { objectKey: s3Result.objectKey });

        progressFill.style.width = '40%';
        progressText.textContent = 'Uploading to ' + (storageType === 'cloud' ? 'cloud' : 'local') + ' storage...';

        // Upload file content
        const fileContent = await file.arrayBuffer();
        const uploadResponse = await fetch(s3Result.signedUrl, {
            method: 'PUT',
            body: fileContent,
            headers: { 'Content-Type': file.type || 'application/octet-stream' }
        });

        if (!uploadResponse.ok) {
            throw new Error('Upload failed: HTTP ' + uploadResponse.status);
        }

        progressFill.style.width = '70%';
        progressText.textContent = 'Saving to database...';

        // Store in Convex
        const convexResult = await window.api.storeViaHttp({
            objectKey: s3Result.objectKey,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type || 'application/octet-stream',
            storageType
        });

        if (!convexResult.success) {
            throw new Error('Database save failed');
        }

        progressFill.style.width = '100%';
        progressText.textContent = 'All done! Your file is safe.';
        log('success', 'user', 'Upload completed', { fileName: file.name });

        setTimeout(() => {
            progressContainer.style.display = 'none';
            progressFill.style.width = '0%';
            loadFiles();
        }, 1500);

    } catch (error) {
        log('error', 'system', 'Upload failed', { error: error.message });
        progressText.textContent = 'Upload failed: ' + error.message;
        setTimeout(() => {
            progressContainer.style.display = 'none';
            progressFill.style.width = '0%';
        }, 5000);
    }
}

// --- Generate Test File ---

async function generateTestFile() {
    log('info', 'user', 'Generating test file...');

    const buttons = document.querySelectorAll('.action-buttons button');
    const genButton = buttons[1]; // Generate Test File button
    const originalText = genButton.textContent;
    genButton.disabled = true;
    genButton.textContent = 'Generating...';

    try {
        const result = await window.api.generateTestFile();

        if (result.success) {
            log('success', 'api', 'Test file generated', { fileName: result.fileName });
            await refreshAll();
            alert('Test file generated!\n\nFile: ' + result.fileName + '\nSize: ' + (result.fileSize / (1024 * 1024)).toFixed(2) + ' MB');
        } else {
            log('error', 'api', 'Test file generation failed', { error: result.error });
            alert('Failed: ' + result.error);
        }
    } catch (error) {
        log('error', 'api', 'Test file error', { error: error.message });
        alert('Error: ' + error.message);
    }

    genButton.disabled = false;
    genButton.textContent = originalText;
}

// --- File Loading & Display ---

async function loadFiles() {
    log('info', 'system', 'Loading files...');
    try {
        const files = await window.api.getAllFiles();
        log('success', 'api', 'Files loaded', { count: files.length });
        allFiles = files;
        displayFiles(files);
        updateStats(files);
    } catch (error) {
        log('error', 'api', 'Failed to load files', { error: error.message });
    }
}

function displayFiles(files) {
    const fileList = document.getElementById('fileList');

    if (files.length === 0) {
        fileList.innerHTML =
            '<div class="empty-state">' +
            '<div class="empty-icon">&#128194;</div>' +
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
            '<div class="file-name">' + escapeHtml(file.fileName) + '</div>' +
            '<div class="file-meta">' + sizeFormatted + ' &middot; ' + timeAgo + '</div>' +
            '</div>' +
            '<div class="storage-badge ' + file.storageType + '">' + file.storageType + '</div>' +
            '<div class="file-actions">' +
            '<button class="icon-btn" onclick="event.stopPropagation(); downloadFile(\'' + escapeAttr(file.objectKey) + '\')" title="Download">&#11015;</button>' +
            '<button class="icon-btn" onclick="event.stopPropagation(); deleteFile(\'' + escapeAttr(file._id) + '\')" title="Delete">&#128465;</button>' +
            '</div>' +
            '</div>';
    }).join('');
}

function filterFiles() {
    const searchTerm = document.getElementById('searchBar').value.toLowerCase();
    const filtered = allFiles.filter(file =>
        file.fileName.toLowerCase().includes(searchTerm)
    );
    displayFiles(filtered);
}

function updateStats(files) {
    const total = files.length;
    const local = files.filter(f => f.storageType === 'local').length;
    const cloud = files.filter(f => f.storageType === 'cloud').length;

    document.getElementById('totalFiles').textContent = total;
    document.getElementById('localFiles').textContent = local;
    document.getElementById('cloudFiles').textContent = cloud;
}

// --- File Actions ---

async function downloadFile(objectKey) {
    log('info', 'user', 'Download requested', { objectKey });
    try {
        const result = await window.api.downloadToNeutralBase(objectKey);
        if (result.success) {
            log('success', 'api', 'Downloaded', { path: result.path });
            alert('Downloaded!\n\nPath: ' + result.path);
        } else {
            throw new Error(result.error || 'Download failed');
        }
    } catch (error) {
        log('error', 'user', 'Download failed', { error: error.message });
        alert('Download failed: ' + error.message);
    }
}

async function deleteFile(fileId) {
    if (!confirm('Delete this file permanently?')) return;

    log('warning', 'user', 'Deleting file', { fileId });
    try {
        const result = await window.api.deleteFile(fileId);
        if (result.success) {
            log('success', 'user', 'File deleted', { fileName: result.fileName });
            await loadFiles();
            alert('File "' + result.fileName + '" deleted.');
        } else {
            throw new Error(result.error || 'Delete failed');
        }
    } catch (error) {
        log('error', 'user', 'Delete failed', { error: error.message });
        alert('Delete failed: ' + error.message);
    }
}

function showFileDetails(fileIndex) {
    const file = allFiles[fileIndex];
    if (!file) return;

    document.getElementById('detailFileName').textContent = file.fileName;
    document.getElementById('detailObjectKey').textContent = file.objectKey;
    document.getElementById('detailFileSize').textContent = formatBytes(file.fileSize);
    document.getElementById('detailMimeType').textContent = file.mimeType;
    document.getElementById('detailStorageType').textContent = file.storageType;
    document.getElementById('detailTimestamp').textContent = new Date(file.timestamp).toLocaleString();
    document.getElementById('detailId').textContent = file._id;

    document.getElementById('fileDetailsModal').style.display = 'flex';
}

// --- Cloud Migration ---

async function migrateToCloud() {
    const filesToMigrate = allFiles.filter(file =>
        file.storageType === 'local' && file.fileSize > 5 * 1024 * 1024
    );

    if (filesToMigrate.length === 0) {
        alert('No files need migration!\n\nAll large files (>5MB) are already in cloud storage.');
        return;
    }

    if (!confirm('Migrate ' + filesToMigrate.length + ' large files (>5MB) to cloud storage?')) return;

    log('info', 'migration', 'Starting migration', { count: filesToMigrate.length });

    let successCount = 0;
    for (const file of filesToMigrate) {
        try {
            log('info', 'migration', 'Queued: ' + file.fileName);
            successCount++;
        } catch (error) {
            log('error', 'migration', 'Failed: ' + file.fileName, { error: error.message });
        }
    }

    alert('Migration queued: ' + successCount + ' files.\n\nNote: Full migration requires backend implementation.');
    loadFiles();
}

function refreshAll() {
    log('info', 'user', 'Refreshing...');
    return loadFiles();
}

// --- Utility Functions ---

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
    if (!mimeType) return '&#128206;';
    if (mimeType.includes('pdf')) return '&#128196;';
    if (mimeType.includes('image')) return '&#128444;';
    if (mimeType.includes('video')) return '&#127909;';
    if (mimeType.includes('audio')) return '&#127925;';
    if (mimeType.includes('text')) return '&#128221;';
    return '&#128206;';
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function escapeAttr(str) {
    return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}
