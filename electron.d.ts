import type { ElectronAPI } from "@electron-toolkit/preload";

interface ActivateLicenseResponse {
	activation_succeeded: boolean;
	instance_id: string;
	error: null | string;
	meta: {
		store_id: number;
		product_id: number;
	};
}

declare global {
	interface Window {
		electron: ElectronAPI;
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
