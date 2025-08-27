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
		start: () => Promise<any>;
		stop: () => Promise<any>;
		restart: () => Promise<any>;
	};

	// Kash integration (File processing)
	kash: {
		processFiles: (request: {
			action: string;
			files?: string[];
			useSelection?: boolean;
		}) => Promise<any>;
		getFinderSelection: () => Promise<{
			success: boolean;
			files?: string[];
			error?: string;
		}>;
		startSelectionMonitor: () => Promise<{ success: boolean; error?: string }>;
		stopSelectionMonitor: () => Promise<{ success: boolean; error?: string }>;
		checkDependencies: () => Promise<{
			success: boolean;
			dependencies?: {
				python: boolean;
				kash: boolean;
				version?: string;
			};
			error?: string;
		}>;
		// Lazy-loading installation
		checkInstallation: () => Promise<{
			success: boolean;
			installed: boolean;
			actions: string[];
		}>;
		install: (options: {
			actions: string[];
		}) => Promise<{
			success: boolean;
			installedActions: string[];
			error?: string;
		}>;
		uninstall: () => Promise<{ success: boolean }>;
		onInstallProgress: (callback: (progress: {
			percent: number;
			message: string;
			phase: 'preparing' | 'downloading' | 'installing' | 'configuring' | 'complete' | 'error';
		}) => void) => () => void;
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

interface ActivateLicenseResponse {
	activation_succeeded: boolean;
	instance_id: string;
	error: null | string;
	meta: {
		store_id: number;
		product_id: number;
	};
}

// Global augmentation for Window interface
declare global {
	interface Window {
		electron: IElectronAPI;
		api: {
			getLicense: () => Promise<string>;
			setLicense: (license: string) => Promise<void>;
			getInstanceId: () => Promise<string>;
			setInstanceId: (instanceId: string) => Promise<void>;
			getEmail: () => Promise<string>;
			setEmail: (email: string) => Promise<void>;

			validateLicense: (
				licenseKey: string,
				instanceId: string,
			) => Promise<boolean>;
			activateLicense: (
				licenseKey: string,
				email: string,
			) => Promise<ActivateLicenseResponse>;
			deactivateLicense: (
				licenseKey: string,
				instanceId: string,
			) => Promise<boolean>;

			// // LLMs Setup
			// getApiKeys: () => Promise<Record<string, string>>
			// setApiKeys: (apiKeys: Record<string, string>) => Promise<void>
			// getCustomModelUrl: () => Promise<string>
			// setCustomModelUrl: (url: string) => Promise<void>

			// // Search and Scrape
			// getPerplexityApiKey: () => Promise<string>
			// setPerplexityApiKey: (key: string) => Promise<void>
			// getFirecrawlApiKey: () => Promise<string>
			// setFirecrawlApiKey: (key: string) => Promise<void>

			// Survey
			submitSurvey: (
				surveyData: any,
				email: string,
			) => Promise<{ success: boolean; data?: any; error?: string }>;
		};
	}
}
