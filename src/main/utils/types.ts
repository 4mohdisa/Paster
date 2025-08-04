export interface StorageData {
	email?: string;
	license?: string;
	instanceId?: string;
	[key: string]: unknown;
}

export interface AuthCredentials {
	email: string;
	licenseKey: string;
}

export interface AuthResult {
	success: boolean;
	userId?: string;
	instanceId?: string;
	error?: string;
}