import { electronAPI } from "@electron-toolkit/preload";
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

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
	try {
		contextBridge.exposeInMainWorld("electron", electronAPI);
		contextBridge.exposeInMainWorld("api", api);
	} catch (error) {
		console.error(error);
	}
} else {
	// @ts-ignore (define in dts)j
	window.electron = electronAPI;
	// @ts-ignore (define in dts)
	window.api = api;
}
