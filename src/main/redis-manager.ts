import { type ChildProcess, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import Redis from "ioredis";
import { logError, logInfo, logWarn } from "./logger";

let client: Redis | null = null;
let redisServerProcess: ChildProcess | null = null;

export async function initRedis(port = 6379): Promise<Redis> {
	if (!client) {
		client = new Redis({
			host: "127.0.0.1",
			port: port,
			db: 0,
			maxRetriesPerRequest: 3,
			retryStrategy(times) {
				const delay = Math.min(times * 50, 2000);
				return delay;
			},
		});

		try {
			await client.ping();
			logInfo("Redis connection established");
		} catch (error) {
			logError(`Redis connection failed: ${error}`);
			throw error;
		}
	}
	return client;
}

export async function closeRedis(): Promise<void> {
	if (client) {
		await client.quit();
		client = null;
		logInfo("Redis connection closed");
	}
}

export function getRedisClient(): Redis {
	if (!client) {
		throw new Error("Redis client not initialized");
	}
	return client;
}

export function startRedisServer(port = 6379): ChildProcess {
	if (redisServerProcess && !redisServerProcess.killed) {
		logInfo("Redis server is already running, reusing existing process");
		return redisServerProcess;
	}

	const isDev = !app.isPackaged;
	const platform = process.platform;
	const redisExecutable =
		platform === "win32" ? "redis-server.exe" : "redis-server";

	const redisDataDir = path.join(app.getPath("userData"), "redis-data");
	if (!fs.existsSync(redisDataDir)) {
		fs.mkdirSync(redisDataDir, { recursive: true });
	}

	const redisPath = isDev
		? path.join(
				app.getAppPath(),
				"resources",
				"binaries",
				"redis",
				platform,
				redisExecutable,
			)
		: path.join(
				process.resourcesPath,
				"app.asar.unpacked",
				"resources",
				"binaries",
				"redis",
				platform,
				redisExecutable,
			);

	logInfo(`Starting Redis from: ${redisPath} on port ${port}`);
	logInfo(`Redis data directory: ${redisDataDir}`);

	const redisConfig = [
		redisPath,
		"--port",
		port.toString(),
		"--dir",
		redisDataDir,
		"--dbfilename",
		"dump.rdb",
		"--save",
		"900",
		"1",
		"--save",
		"300",
		"10",
		"--save",
		"60",
		"10000",
	];

	const redisProcess = spawn(redisConfig[0], redisConfig.slice(1));

	redisProcess.stdout.on("data", (data) => {
		logInfo(`Redis stdout: ${data}`);
	});

	redisProcess.stderr.on("data", (data) => {
		logError(`Redis stderr: ${data}`);
	});

	redisProcess.on("exit", (code, signal) => {
		logInfo(`Redis process exited with code ${code}, signal ${signal}`);
		redisServerProcess = null;
	});

	redisServerProcess = redisProcess;
	return redisProcess;
}

export function ensureRedisIsRunning(): ChildProcess {
	if (!redisServerProcess || redisServerProcess.killed) {
		logInfo("Redis is not running, starting it now");
		return startRedisServer();
	}
	logInfo("Redis is already running");
	return redisServerProcess;
}

export async function stopRedisServer(): Promise<void> {
	if (redisServerProcess && !redisServerProcess.killed) {
		logInfo("Stopping Redis server");
		await closeRedis();

		redisServerProcess.kill();

		return new Promise((resolve) => {
			redisServerProcess?.on("exit", () => {
				redisServerProcess = null;
				logInfo("Redis server stopped");
				resolve();
			});

			setTimeout(() => {
				if (redisServerProcess) {
					redisServerProcess = null;
					logWarn("Redis server stop timed out, forcing shutdown");
					resolve();
				}
			}, 5000);
		});
	}
}
