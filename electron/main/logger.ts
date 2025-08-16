import log from "electron-log/main";

log.transports.file.level = "info";
log.transports.console.level = "debug";

log.transports.console.format = "{h}:{i}:{s}.{ms} {level} {text}";

log.info(`Log file path: ${log.transports.file.getFile().path}`);

export function logInfo(message: string): void {
	log.info(`%c${message}`, "color: blue");
}

export function logError(message: string): void {
	log.error(`%c${message}`, "color: red");
}

export function logWarn(message: string): void {
	log.warn(`%c${message}`, "color: yellow");
}

export function logDebug(message: string): void {
	log.debug(`%c${message}`, "color: green");
}
