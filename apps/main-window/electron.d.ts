// Type definitions for the Electron preload script API
// Following Electron's official recommendations for TypeScript in 2025

export interface IElectronAPI {
	// Swift CLI functions
	formatTable: (input: string, format?: string) => Promise<string>;
	executePaste: (options?: any) => Promise<any>;
	getSettings: () => Promise<any>;
	updateSettings: (settings: any) => Promise<any>;

	// Process management
	checkSystemStatus: () => Promise<any>;
	checkPermissions: () => Promise<any>;
	startShortcuts: () => Promise<any>;
	stopShortcuts: () => Promise<any>;
	shortcutsStatus: () => Promise<any>;

	// Convex backend
	convex: {
		getInfo: () => Promise<any>;
	};

	// Kash integration  
	kash: {
		processFiles: (request: any) => Promise<any>;
		getFinderSelection: () => Promise<any>;
		startSelectionMonitor: () => Promise<any>;
		stopSelectionMonitor: () => Promise<any>;
		checkDependencies: () => Promise<any>;
		install: (options?: any) => Promise<{
			success: boolean;
			error?: string;
		}>;
	};

	// IPC renderer - for direct communication
	ipcRenderer: {
		on: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
		removeListener: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
		removeAllListeners: (channel: string) => void;
		send: (channel: string, ...args: any[]) => void;
		invoke: (channel: string, ...args: any[]) => Promise<any>;
	};
}

// Global augmentation for Window interface
declare global {
	interface Window {
		electron: IElectronAPI;
	}
}
