import { contextBridge, ipcRenderer } from "electron";


// Swift and process management APIs
const electronAPI = {
	// Swift CLI functions
	formatTable: (input: string, format?: string) =>
		ipcRenderer.invoke("swift:format-table", input, format),
	executePaste: (options?: any) =>
		ipcRenderer.invoke("swift:execute-paste", options),
	getSettings: () => ipcRenderer.invoke("swift:get-settings"),
	updateSettings: (settings: any) =>
		ipcRenderer.invoke("swift:update-settings", settings),
	
	// Process management
	checkSystemStatus: () => ipcRenderer.invoke("process:check-status"),
	checkPermissions: () => ipcRenderer.invoke("process:check-permissions"),
	startShortcuts: () => ipcRenderer.invoke("process:start-shortcuts"),
	stopShortcuts: () => ipcRenderer.invoke("process:stop-shortcuts"),
	shortcutsStatus: () => ipcRenderer.invoke("process:shortcuts-status"),
	
	// Convex backend management
	convex: {
		getInfo: () => ipcRenderer.invoke("convex:get-info"),
		start: () => ipcRenderer.invoke("convex:start"),
		stop: () => ipcRenderer.invoke("convex:stop"),
		restart: () => ipcRenderer.invoke("convex:restart"),
	},
	
	// Kash integration
	kash: {
		processFiles: (request: any) => ipcRenderer.invoke('kash:process-files', request),
		getFinderSelection: () => ipcRenderer.invoke('kash:get-finder-selection'),
		startSelectionMonitor: () => ipcRenderer.invoke('kash:start-selection-monitor'),
		stopSelectionMonitor: () => ipcRenderer.invoke('kash:stop-selection-monitor'),
		checkDependencies: () => ipcRenderer.invoke('kash:check-dependencies'),
		// Lazy-loading installation
		checkInstallation: () => ipcRenderer.invoke('kash:check-installation'),
		install: (options: any) => ipcRenderer.invoke('kash:install', options),
		uninstall: () => ipcRenderer.invoke('kash:uninstall'),
		onInstallProgress: (callback: (progress: any) => void) => {
			ipcRenderer.on('kash:install-progress', (event, progress) => callback(progress));
			return () => ipcRenderer.removeAllListeners('kash:install-progress');
		},
	},
	
	// IPC renderer for events
	ipcRenderer: {
		on: (channel: string, listener: (event: any, ...args: any[]) => void) => {
			const validChannels = [
				'shortcut-triggered', 
				'permission-required', 
				'permission-granted',
				'history-item-added',
				'history-cleared',
				'history-copied',
				'history-pasted',
				'convex-ready',
				'convex-error',
				'kash:selection-changed',
				'kash-conversion-complete'  // Added for file conversion events
			];
			if (validChannels.includes(channel)) {
				ipcRenderer.on(channel, listener);
			}
		},
		removeListener: (channel: string, listener: (event: any, ...args: any[]) => void) => {
			ipcRenderer.removeListener(channel, listener);
		},
		removeAllListeners: (channel: string) => {
			ipcRenderer.removeAllListeners(channel);
		},
		send: (channel: string, ...args: any[]) => {
			ipcRenderer.send(channel, ...args);
		},
		invoke: (channel: string, ...args: any[]) => {
			return ipcRenderer.invoke(channel, ...args);
		}
	}
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
	try {
		contextBridge.exposeInMainWorld("electron", electronAPI);
	} catch (error) {
		console.error(error);
	}
} else {
	// @ts-ignore (define in dts)
	window.electron = electronAPI;
}
