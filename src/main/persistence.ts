import crypto from "node:crypto";
import fs, { type PathLike } from "node:fs";
import path from "node:path";
import { app } from "electron";
import { machineIdSync } from "node-machine-id";
import { logError, logInfo } from "./logger";
import { updateStorage } from "./shared/state";
import type { StorageData } from "./utils/types";

const IV_LENGTH = 16;
const ENCRYPTION_KEY = deriveKey();

function deriveKey(): Buffer {
	const machineId = machineIdSync();
	const appId = app.getPath("userData");
	const salt = "juG/6pJlHeg=";
	const input = machineId + appId + salt;
	return crypto.pbkdf2Sync(input, salt, 100000, 32, "sha256");
}

function encrypt(text: string): string {
	const iv = crypto.randomBytes(IV_LENGTH);
	const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
	let encrypted = cipher.update(text, "utf8", "hex");
	encrypted += cipher.final("hex");
	return `${iv.toString("hex")}:${encrypted}`;
}

function decrypt(text: string): string {
	const [ivHex, encryptedHex] = text.split(":");
	const iv = Buffer.from(ivHex, "hex");
	const decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
	let decrypted = decipher.update(encryptedHex, "hex", "utf8");
	decrypted += decipher.final("utf8");
	return decrypted;
}

export function readStorage(storageFilePath: PathLike): StorageData {
	try {
		const encryptedData = fs.readFileSync(storageFilePath, "utf-8");
		const decryptedData = decrypt(encryptedData);
		return JSON.parse(decryptedData);
	} catch (error) {
		return {};
	}
}

export function writeStorage(
	storageFilePath: PathLike,
	data: StorageData,
): void {
	const jsonData = JSON.stringify(data);
	const encryptedData = encrypt(jsonData);
	fs.writeFileSync(storageFilePath, encryptedData);
	updateStorage(data);
}

export function getStorageFilePath(): string {
	const userDataPath = app.getPath("userData");
	return path.join(userDataPath, "storage.dat");
}

export function updateSetting(settingsToUpdate: Partial<StorageData>): void {
	try {
		const filePath = getStorageFilePath();
		const storage = readStorage(filePath);

		for (const [key, val] of Object.entries(settingsToUpdate)) {
			storage[key] = val;
			logInfo(`Updated setting: ${key}`);
		}

		writeStorage(filePath, storage);
	} catch (error) {
		logError(`Error updating settings: ${error}`);
		throw error;
	}
}
