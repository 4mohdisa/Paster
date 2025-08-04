import { app, dialog } from "electron";
import log from "electron-log";
import { autoUpdater } from "electron-updater";

autoUpdater.logger = log;
// The autoupdater looks for update files at the url defined in the electron-builder.yml

export function setupAutoUpdater() {
	autoUpdater.on("checking-for-update", () => {
		// TODO: update app state to show that we're checking for updates
	});

	autoUpdater.on("update-not-available", () => {
		// TODO: update app state to show that there are no updates available
	});

	autoUpdater.on("update-available", (info) => {
		dialog
			.showMessageBox({
				type: "info",
				title: "Update Available",
				message: `A new version (${info.version}) is available. Would you like to download and install it now?`,
				buttons: ["Yes", "No"],
			})
			.then((result) => {
				if (result.response === 0) {
					autoUpdater.downloadUpdate();
				}
			});
	});

	autoUpdater.on("update-downloaded", (info) => {
		dialog
			.showMessageBox({
				type: "info",
				title: "Update Ready",
				message: `Version ${info.version} has been downloaded and is ready to install. Would you like to restart and install now?`,
				buttons: ["Yes", "No"],
			})
			.then((result) => {
				if (result.response === 0) {
					autoUpdater.quitAndInstall();
				}
			});
	});

	autoUpdater.on("error", (err) => {
		dialog.showErrorBox("Error", `An error occurred while updating: ${err}`);
	});
}

export function checkForUpdates() {
	autoUpdater.checkForUpdates();
}

export function checkForUpdatesAndNotify() {
	autoUpdater.checkForUpdatesAndNotify();
}

export function manualCheckForUpdates() {
	autoUpdater
		.checkForUpdates()
		.then((checkResult) => {
			if (checkResult && checkResult.updateInfo.version !== app.getVersion()) {
				dialog
					.showMessageBox({
						type: "info",
						title: "Update Available",
						message: `A new version (${checkResult.updateInfo.version}) is available. Would you like to download and install it now?`,
						buttons: ["Yes", "No"],
					})
					.then((result) => {
						if (result.response === 0) {
							autoUpdater.downloadUpdate().then(() => {
								dialog
									.showMessageBox({
										type: "info",
										title: "Update Ready",
										message:
											"Update has been downloaded. The application will now restart to install the update.",
										buttons: ["Okay"],
									})
									.then(() => {
										autoUpdater.quitAndInstall(false, true);
									});
							});
						}
					});
			} else {
				dialog.showMessageBox({
					type: "info",
					title: "No Updates",
					message: "You are running the latest version.",
				});
			}
		})
		.catch((error) => {
			dialog.showErrorBox(
				"Error",
				`An error occurred while checking for updates: ${error}`,
			);
		});
}
