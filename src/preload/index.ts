import { contextBridge, ipcRenderer } from "electron";

// Custom APIs for renderer
const api = {
	getLicense: () => ipcRenderer.invoke("get-license"),
	setLicense: (license: string) => ipcRenderer.invoke("set-license", license),
	getInstanceId: () => ipcRenderer.invoke("get-instance-id"),
	setInstanceId: (instanceId: string) =>
		ipcRenderer.invoke("set-instance-id", instanceId),
	getEmail: () => ipcRenderer.invoke("get-email"),
	setEmail: (email: string) => ipcRenderer.invoke("set-email", email),

	//
	validateLicense: (licenseKey: string, instanceId: string) =>
		ipcRenderer.invoke("validate-license", licenseKey, instanceId),
	activateLicense: (licenseKey: string, email: string) =>
		ipcRenderer.invoke("activate-license", licenseKey, email),
	deactivateLicense: (licenseKey: string, instanceId: string) =>
		ipcRenderer.invoke("deactivate-license", licenseKey, instanceId),
	submitSurvey: (surveyData: any, email: string) =>
		ipcRenderer.invoke("submit-survey", surveyData, email),
};

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
				'history-pasted'
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
		contextBridge.exposeInMainWorld("api", api);
		contextBridge.exposeInMainWorld("electronAPI", electronAPI);
	} catch (error) {
		console.error(error);
	}
} else {
	// @ts-ignore (define in dts)
	window.electron = electronAPI;
	// @ts-ignore (define in dts)
	window.api = api;
	// @ts-ignore (define in dts)
	window.electronAPI = electronAPI;
}
