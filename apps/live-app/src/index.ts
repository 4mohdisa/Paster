import { exec, spawn, ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";

import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import {
  app,
  BrowserWindow,
  desktopCapturer,
  globalShortcut,
  ipcMain,
  screen,
  session,
  nativeImage,
  dialog,
} from "electron";
import { Menubar, menubar } from "menubar";
import WebSocket from "ws";

dotenv.config();
const windowWidth = 70;
const windowHeight = 80;

// -------------------- EXTERNAL SERVICES / GLOBALS --------------------

const resolvedGeminiApiKey =
  process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "";
if (!resolvedGeminiApiKey) {
  console.error(
    "GEMINI_API_KEY/GOOGLE_AI_API_KEY is not set. Create a key in Google AI Studio or Google Cloud (with Generative Language API enabled) and place it in your .env as GEMINI_API_KEY.",
  );
}

export const geminiAI = new GoogleGenAI({
  apiKey: resolvedGeminiApiKey,
});

let mainWindow: BrowserWindow | null = null;
let mb: Menubar | null = null;

// Window position memory system
let rememberedPosition: {
  x: number;
  y: number;
  width: number;
  height: number;
} | null = null;
// const isFirstShow = true; // Track if this is the first time showing the window - currently unused

let wss: import("ws").Server;
const wsClients: Set<WebSocket> = new Set();
const WEBSOCKET_PORT = 30010;
let heartbeatInterval: NodeJS.Timeout | null = null;

// Python server process management
let pythonServerProcess: ChildProcess | null = null;
const PYTHON_SERVER_DIR = path.resolve(process.cwd(), "pipecat-server");

// Global pause state for session control
let globalPauseState: boolean = false;
let globalLlmConnectionState: boolean = false;

// Utility
const execAsync = promisify(exec);

// -------------------- PYTHON SERVER MANAGEMENT --------------------




/**
 * Start the Python server using the best available method
 */
function startPythonServer(): void {
  try {
    console.log("🐍 Starting Python server...");
    
    pythonServerProcess = spawn("/opt/homebrew/bin/uv", ["run", "server.py"], {
      cwd: PYTHON_SERVER_DIR,
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
      env: {
        ...process.env,
        PATH: process.env.PATH + ":/opt/homebrew/bin:/usr/local/bin",
      },
    });

    pythonServerProcess.stdout?.on("data", (data) => {
      console.log(`🐍 [Python Server] ${data.toString().trim()}`);
    });

    pythonServerProcess.stderr?.on("data", (data) => {
      const message = data.toString().trim();
      if (!message.includes("DeprecationWarning")) {
        console.log(`🐍 [Python Server Error] ${message}`);
      }
    });

    pythonServerProcess.on("close", (code) => {
      console.log(`🐍 Python server process exited with code ${code}`);
      pythonServerProcess = null;
    });

    pythonServerProcess.on("error", (error) => {
      console.error("🐍 Failed to start Python server:", error);
      pythonServerProcess = null;
    });

    if (pythonServerProcess.pid) {
      console.log(`🐍 Python server started with PID: ${pythonServerProcess.pid}`);
    }
  } catch (error) {
    console.error("🐍 Error starting Python server:", error);
  }
}



/**
 * Stop the Python server process
 */
function stopPythonServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!pythonServerProcess) {
      resolve();
      return;
    }

    console.log("🐍 Stopping Python server...");
    
    pythonServerProcess.on("close", () => {
      console.log("🐍 Python server stopped successfully");
      pythonServerProcess = null;
      resolve();
    });

    // Try graceful shutdown first
    pythonServerProcess.kill("SIGTERM");
    
    // Force kill after 5 seconds if it doesn't stop gracefully
    setTimeout(() => {
      if (pythonServerProcess && !pythonServerProcess.killed) {
        console.log("🐍 Force killing Python server...");
        pythonServerProcess.kill("SIGKILL");
        pythonServerProcess = null;
        resolve();
      }
    }, 5000);
  });
}

// Electron Forge/Vite globals
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

// -------------------- APP LIFECYCLE --------------------
// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit();
}

// Essential WebRTC configuration for Electron
console.log("🔌 [Electron Main] Configuring WebRTC command line switches...");
app.commandLine.appendSwitch('--disable-web-security');
app.commandLine.appendSwitch('--allow-running-insecure-content');
app.commandLine.appendSwitch('--disable-features', 'WebRtcHideLocalIpsWithMdns');

// Add comprehensive WebRTC debugging
console.log("🔌 [Electron Main] Adding WebRTC debugging switches...");
app.commandLine.appendSwitch('--enable-logging');
app.commandLine.appendSwitch('--log-level', '0'); // INFO level
app.commandLine.appendSwitch('--enable-webrtc-logs');
app.commandLine.appendSwitch('--vmodule', 'webrtc*=1,pc*=1,sdp*=1');

// Additional WebRTC flags to help with codec issues
app.commandLine.appendSwitch('--force-webrtc-ip-handling-policy', 'default');
app.commandLine.appendSwitch('--disable-features', 'WebRtcHybridAgcAudioProc');

// Log all command line switches that were applied
console.log("🔌 [Electron Main] Applied command line switches:", process.argv);

app.on("ready", initializeMenuBar);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    cleanupGlobalShortcuts();
  }
});

app.on("activate", () => {
  // For menu bar apps, we don't recreate windows on activate
  // The window is managed by the menu bar instance
});

// -------------------- APP CLEANUP ON SHUTDOWN --------------------

let isCleaningUp = false;

app.on("before-quit", async (event) => {
  if (isCleaningUp) return;

  console.log("🛑 App shutting down - starting cleanup...");
  isCleaningUp = true;

  // Prevent immediate quit to allow cleanup
  event.preventDefault();

  try {
    // Stop Python server first
    await stopPythonServer();

    // Cleanup incomplete file processing
    // await fileProcessingService.cleanupIncompleteProcessing();

    // Cleanup global shortcuts
    cleanupGlobalShortcuts();

    // Cleanup WebSocket server
    if (wss) {
      wss.close();
      wsClients.clear();
    }

    // Cleanup menubar and tray
    if (mb) {
      if (mb.tray) {
        mb.tray.destroy();
      }
      if (mb.window && !mb.window.isDestroyed()) {
        mb.window.destroy();
      }
      // Clear the reference
      mb = null as Menubar | null;
    }

    console.log("🏁 Cleanup complete - app can now quit");
  } catch (error) {
    console.error("❌ Error during app cleanup:", error);
  } finally {
    // Force quit after cleanup (or timeout)
    app.quit();
  }
});

app.on("will-quit", async (event) => {
  if (isCleaningUp) return;

  console.log("⚡ Force quit detected - attempting quick cleanup...");
  isCleaningUp = true;

  // Prevent immediate quit for a brief cleanup attempt
  event.preventDefault();

  // Set a timeout to ensure app quits even if cleanup hangs
  const timeoutId = setTimeout(() => {
    console.log("⏰ Cleanup timeout - forcing quit");
    app.exit(0);
  }, 3000); // 3 second timeout

  try {
    await stopPythonServer();
    // await fileProcessingService.cleanupIncompleteProcessing();
    cleanupGlobalShortcuts();
    console.log("⚡ Quick cleanup complete");
  } catch (error) {
    console.error("❌ Error during quick cleanup:", error);
  } finally {
    clearTimeout(timeoutId);
    app.exit(0);
  }
});

// -------------------- MENUBAR INITIALIZATION --------------------

function initializeMenuBar(): void {
  // Prevent duplicate initialization
  if (mb && !mb.window?.isDestroyed()) {
    console.log("MenuBar already initialized and active");
    return;
  }

  setupSessionHandlers();

  // Create a minimal transparent icon to avoid file loading issues
  const createMinimalIcon = () => {
    // Create a minimal 16x16 transparent PNG buffer
    const buffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00, 0x10,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0xf3, 0xff, 0x61, 0x00, 0x00, 0x00,
      0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
    return nativeImage.createFromBuffer(buffer);
  };

  // Initialize menubar
  mb = menubar({
    index:
      MAIN_WINDOW_VITE_DEV_SERVER_URL ||
      `file://${path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)}`,
    preloadWindow: true,
    showDockIcon: false,
    icon: createMinimalIcon(),
    tooltip: "Neural App - Press Cmd+Shift+N to toggle interface",
    browserWindow: {
      height: windowHeight,
      width: windowWidth,
      x: -2000, // Start off-screen to prevent flicker
      y: -2000, // Start off-screen to prevent flicker
      skipTaskbar: true,
      show: true, // Always visible - start in pill mode
      frame: false,
      // transparent: true,
      transparent: false,
      resizable: true,
      maximizable: false,
      movable: true,
      alwaysOnTop: true, // Keep window on top of all other windows including fullscreen apps
      // titleBarStyle: 'hidden', // Hide the title bar but keep window controls accessible
      webPreferences: {
        preload: path.join(__dirname, "../preload/preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: false,
        allowRunningInsecureContent: true,
        // Additional WebRTC-specific preferences
        experimentalFeatures: true,
        // enableRemoteModule: false,
        // Enable access to WebRTC APIs
        enableBlinkFeatures: 'WebRTCInsertableStreams',
      },
      fullscreenable: false,
    },
    showOnAllWorkspaces: true, // Better positioning control
    showOnRightClick: false, // Disable right-click to show
  });

  mb.on("ready", () => {
    console.log("🔌 [Electron Main] Menu bar app is ready");
    console.log("🔌 [Electron Main] WebRTC debugging is enabled");
    console.log("🔌 [Electron Main] Command line switches active:", app.commandLine.hasSwitch('enable-webrtc-logs'));
    mainWindow = mb?.window ?? null;

    // Disable all menubar's internal window management events
    mb?.removeAllListeners("before-show");
    mb?.removeAllListeners("show");
    mb?.removeAllListeners("after-show");
    mb?.removeAllListeners("hide");
    mb?.removeAllListeners("after-hide");

    // Set initial position to bottom center (default position) and show window
    if (mainWindow) {
      setDefaultWindowPosition();

      // Set window level to ensure it stays on top of fullscreen apps
      if (process.platform === "darwin") {
        mainWindow.setAlwaysOnTop(true, "screen-saver");
      } else {
        mainWindow.setAlwaysOnTop(true, "normal");
      }

      // Show window immediately in pill mode
      mainWindow.show();
      mainWindow.focus();
      // debug console window
      // mainWindow.webContents.openDevTools();
      // Setup position memory system
      setupPositionMemory();
      // Prevent window from zooming/maximizing on double-click
      setupWindowZoomPrevention();
    }

    // Set the menu bar title to "N" after initialization
    if (mb?.tray) {
      mb.tray.setTitle("N");
      // Completely override menubar's tray click behavior
      // Remove all existing listeners first
      mb.tray.removeAllListeners("click");
      mb.tray.removeAllListeners("right-click");
      mb.tray.removeAllListeners("double-click");

      // Add our custom interface toggle function
      mb.tray.on("click", () => {
        console.log("Tray clicked - toggling interface mode");
        toggleInterfaceMode();
      });

      // Prevent any other click handlers from interfering
      mb.tray.on("double-click", () => {
        console.log("Tray double-clicked - toggling interface mode");
        toggleInterfaceMode();
      });
    }

    // Override menubar's internal clicked method to prevent interference
    if (mb && typeof (mb as any).clicked === "function") {
      (mb as any).clicked = () => {
        console.log(
          "Menubar internal clicked method called - redirecting to interface toggle",
        );
        toggleInterfaceMode();
      };
    }

    setupGlobalHotkeys();
    startPythonServer(); // Start Python server before WebSocket server
    setupWebSocketServer();
    // fileProcessingService.setMainWindow(mainWindow);
    registerSimpleStreamingHotkeys();
    setupWindowHandlers();
  });

  // Remove the default menubar show/hide event handlers since we're managing this ourselves
}

function setupSessionHandlers(): void {
  // Desktop capture permissions/handling
  session.defaultSession.setDisplayMediaRequestHandler(
    (
      _request: Electron.DisplayMediaRequestHandlerHandlerRequest,
      callback: (streams: Electron.Streams) => void,
    ) => {
      desktopCapturer
        .getSources({ types: ["screen"] })
        .then((sources: Electron.DesktopCapturerSource[]) => {
          callback({ video: sources[0], audio: "loopback" });
        });
    },
    { useSystemPicker: true },
  );

  // Content Security Policy
  session.defaultSession.webRequest.onHeadersReceived(
    (
      details: Electron.OnHeadersReceivedListenerDetails,
      callback: (
        headersReceivedResponse: Electron.HeadersReceivedResponse
      ) => void,
    ) => {
      // Fix Google Fonts MIME type issue
      if (details.url.includes('fonts.googleapis.com') && details.responseHeaders) {
        details.responseHeaders['content-type'] = ['text/css'];
      }
      
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [
            "default-src 'self' 'unsafe-inline' data: blob: https: *.googleapis.com *.gstatic.com; " +
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' data: blob:; " +
              "script-src-elem 'self' 'unsafe-inline' data: blob:; " +
              "style-src 'self' 'unsafe-inline' https: *.googleapis.com; " +
              "style-src-elem 'self' 'unsafe-inline' https: *.googleapis.com; " +
              "connect-src 'self' wss: https: ws: http://localhost:* http://127.0.0.1:*; " +
              "worker-src 'self' blob:; " +
              "font-src 'self' https: data: *.googleapis.com *.gstatic.com;",
          ],
        },
      });
    },
  );
}

// -------------------- IPC HANDLERS --------------------

// ipcMain.on("resize-window", (event, height) => {
//   if (mainWindow) {
//     const { width } = mainWindow.getBounds();
//     mainWindow.setSize(width, height);
//   }
// });

ipcMain.on("resize-window-from-bottom", (_event, height, width) => {
  if (mainWindow) {
    const { x, y } = mainWindow.getBounds();
    const currentHeight = mainWindow.getBounds().height;
    const { height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

    // Calculate new Y position to keep bottom edge fixed
    const newY = Math.max(0, y - (height - currentHeight));

    // Ensure window doesn't go above screen bounds
    const finalY = Math.max(0, Math.min(newY, screenHeight - height));

    mainWindow.setBounds({ x, y: finalY, width, height });
  }
});

ipcMain.on("resize-window-from-bottom-centered", (_event, height, width) => {
  if (mainWindow) {
    const { x, y, width: currentWidth } = mainWindow.getBounds();
    const currentHeight = mainWindow.getBounds().height;
    const { height: screenHeight, width: screenWidth } =
      screen.getPrimaryDisplay().workAreaSize;

    // Calculate new Y position to keep bottom edge fixed
    const newY = Math.max(0, y - (height - currentHeight));

    // Calculate new X position to center the window horizontally
    const widthDifference = width - currentWidth;
    const newX = x - widthDifference / 2;

    // Ensure window doesn't go above screen bounds
    const finalY = Math.max(0, Math.min(newY, screenHeight - height));

    // Ensure window doesn't go off screen horizontally
    const finalX = Math.max(0, Math.min(newX, screenWidth - width));

    mainWindow.setBounds({ x: finalX, y: finalY, width, height });
  }
});

// ChatGPT-style window dragging
let initialWindowPosition: { x: number; y: number } | null = null;

ipcMain.on("move-window", (_event, deltaX, deltaY) => {
  if (mainWindow) {
    if (!initialWindowPosition) {
      const currentBounds = mainWindow.getBounds();
      initialWindowPosition = { x: currentBounds.x, y: currentBounds.y };
    }

    const newX = initialWindowPosition.x + deltaX;
    const newY = initialWindowPosition.y + deltaY;

    // Get screen bounds to prevent window from going off-screen
    const { width: screenWidth, height: screenHeight } =
      screen.getPrimaryDisplay().workAreaSize;
    const { width: windowWidth, height: windowHeight } = mainWindow.getBounds();

    // Clamp to screen bounds
    const clampedX = Math.max(0, Math.min(newX, screenWidth - windowWidth));
    const clampedY = Math.max(0, Math.min(newY, screenHeight - windowHeight));

    mainWindow.setPosition(clampedX, clampedY);
  }
});

// Reset initial position when mouse is released (will be called from renderer)
ipcMain.on("reset-drag-position", () => {
  initialWindowPosition = null;
});

// Handle pause state updates from renderer
ipcMain.on("set-pause-state", (_event, paused: boolean) => {
  const previousPauseState = globalPauseState;
  globalPauseState = paused;
  // fileProcessingService.setPaused(paused);
  console.log(`Global pause state updated: ${paused ? "PAUSED" : "ACTIVE"}`);

  // Request active tab data when session resumes (paused -> active) and LLM is connected
  if (
    previousPauseState === true &&
    paused === false &&
    globalLlmConnectionState === true
  ) {
    console.log(
      "Session resumed with LLM connected - requesting active tab data",
    );
    requestActiveTabDataFromExtension().catch((error) => {
      console.error(
        "Failed to request active tab data on session resume:",
        error,
      );
    });
  }
});

// Handle LLM connection state updates from renderer
ipcMain.on("set-llm-connection-state", (_event, connected: boolean) => {
  const previousLlmConnectionState = globalLlmConnectionState;
  globalLlmConnectionState = connected;
  // fileProcessingService.setLlmConnectionState(connected);
  console.log(
    `Global LLM connection state updated: ${connected ? "CONNECTED" : "DISCONNECTED"}`,
  );

  // Request active tab data when LLM connects and session is not paused
  if (
    previousLlmConnectionState === false &&
    connected === true &&
    globalPauseState === false
  ) {
    console.log(
      "LLM connected with session active - requesting active tab data",
    );
    requestActiveTabDataFromExtension().catch((error) => {
      console.error(
        "Failed to request active tab data on LLM connection:",
        error,
      );
    });
  }
});

ipcMain.handle("get-window-bounds", () => {
  if (mainWindow) {
    return mainWindow.getBounds();
  }
  return { x: 0, y: 0, width: 0, height: 0 };
});

// Media/source APIs
ipcMain.handle("GET_SOURCES", async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ["screen", "window"],
      thumbnailSize: { width: 0, height: 0 },
      fetchWindowIcons: true,
    });

    // Filter and prioritize screen sources, with primary display first
    const screenSources = sources.filter((source) =>
      source.id.startsWith("screen:"),
    );
    const windowSources = sources.filter((source) =>
      source.id.startsWith("window:"),
    );

    // Find primary display (usually screen:0:0 on most systems)
    const primaryScreen = screenSources.find(
      (source) =>
        source.id.includes(":0:0") ||
        source.name.toLowerCase().includes("entire screen"),
    );

    // Return sources with primary screen first, then other screens, then windows
    const orderedSources = [];

    if (primaryScreen) {
      orderedSources.push(primaryScreen);
    }

    // Add other screen sources
    screenSources.forEach((source) => {
      if (source !== primaryScreen) {
        orderedSources.push(source);
      }
    });

    // Add window sources last
    orderedSources.push(...windowSources);

    console.log(
      "Screen sources ordered:",
      orderedSources.map((s) => ({ id: s.id, name: s.name })),
    );

    return orderedSources;
  } catch (error) {
    console.error("Error getting sources:", error);
    throw error;
  }
});



// No settings IPC: base directory is fixed

// -------------------- FILE CAPTURE (GLOBAL HOTKEY) --------------------

interface SelectedFile {
  path: string;
  name: string;
  extension: string;
  size?: number;
  type: "file" | "directory";
}

/**
 * Get currently selected files from system file explorer
 */
async function getSelectedFiles(): Promise<SelectedFile[]> {
  const platform = process.platform;
  try {
    switch (platform) {
    case "darwin":
      return await getSelectedFilesMacOS();
    case "win32":
      return await getSelectedFilesWindows();
    case "linux":
      return await getSelectedFilesLinux();
    default:
      throw new Error(`Unsupported platform: ${platform}`);
    }
  } catch (error) {
    console.error("Error getting selected files:", error);
    return [];
  }
}

/**
 * macOS: AppleScript via osascript
 */
async function getSelectedFilesMacOS(): Promise<SelectedFile[]> {
  const script = `
    tell application "Finder"
      set selectedItems to selection
      set filePaths to {}
      repeat with anItem in selectedItems
        set end of filePaths to POSIX path of (anItem as alias)
      end repeat
      return filePaths
    end tell
  `;
  try {
    const { stdout } = await execAsync(`osascript -e '${script}'`);
    const pathsString = stdout.trim();
    if (!pathsString || pathsString === "") return [];
    const paths = pathsString.split(", ").map((p) => p.trim());
    return await Promise.all(paths.map(async (p) => getFileInfo(p)));
  } catch (error: any) {
    console.error("Error getting macOS selected files:", error);

    // Check if it's a permission error
    if (
      error.message &&
      error.message.includes("Not authorised to send Apple events")
    ) {
      // Show permission error dialog
      showPermissionErrorDialog();
      throw new Error(
        "Permission required: Please grant Automation permissions to access Finder",
      );
    }

    return [];
  }
}

/**
 * Windows: PowerShell automation
 */
async function getSelectedFilesWindows(): Promise<SelectedFile[]> {
  const script = `
    Add-Type -AssemblyName Microsoft.VisualBasic
    $shell = New-Object -ComObject Shell.Application
    $windows = $shell.Windows()
    $selectedPaths = @()
    foreach ($window in $windows) {
      if ($window.Document -and $window.Document.SelectedItems) {
        foreach ($item in $window.Document.SelectedItems()) {
          $selectedPaths += $item.Path
        }
      }
    }
    $selectedPaths | ConvertTo-Json
  `;
  try {
    const { stdout } = await execAsync(
      `powershell -Command "${script.replace(/"/g, '\\"')}"`,
    );
    const result = stdout.trim();
    if (!result || result === "null") return [];
    let paths: string[];
    try {
      paths = JSON.parse(result);
      if (typeof paths === "string") paths = [paths];
    } catch {
      paths = [result];
    }
    return await Promise.all(paths.map(async (p) => getFileInfo(p)));
  } catch (error) {
    console.error("Error getting Windows selected files:", error);
    return [];
  }
}

/**
 * Linux: clipboard fallback
 */
async function getSelectedFilesLinux(): Promise<SelectedFile[]> {
  try {
    const { stdout } = await execAsync("xclip -selection clipboard -o");
    const paths = stdout
      .trim()
      .split("\n")
      .filter((p) => p && p.startsWith("/"));
    if (paths.length === 0) return [];
    return await Promise.all(paths.map(async (p) => getFileInfo(p)));
  } catch (error) {
    console.error("Error getting Linux selected files:", error);
    return [];
  }
}

/**
 * Stat + path parsing for a given file path
 */
async function getFileInfo(filePath: string): Promise<SelectedFile> {
  try {
    const stats = await fs.promises.stat(filePath);
    const parsedPath = path.parse(filePath);
    return {
      path: filePath,
      name: parsedPath.name,
      extension: parsedPath.ext,
      size: stats.size,
      type: stats.isDirectory() ? "directory" : "file",
    };
  } catch {
    const parsedPath = path.parse(filePath);
    return {
      path: filePath,
      name: parsedPath.name,
      extension: parsedPath.ext,
      type: "file",
    };
  }
}

/**
 * Show permission error dialog for macOS Automation permissions
 */
function showPermissionErrorDialog(): void {
  if (!mainWindow) return;

  dialog
    .showMessageBox(mainWindow, {
      type: "error",
      title: "Permission Required",
      message: "Neural App needs permission to access selected files",
      detail:
        "To capture selected files, please:\n\n" +
        "1. Open System Preferences/Settings\n" +
        "2. Go to Security & Privacy → Privacy\n" +
        "3. Select 'Automation' from the left sidebar\n" +
        "4. Find 'Neural App' and check the box next to 'Finder'\n" +
        "5. Restart the application\n\n" +
        "This allows the app to see which files you've selected in Finder.",
      buttons: ["Open System Preferences", "Cancel"],
      defaultId: 0,
      cancelId: 1,
    })
    .then((result) => {
      if (result.response === 0) {
        // Open System Preferences to Privacy settings
        execAsync(
          "open 'x-apple.systempreferences:com.apple.preference.security?Privacy_Automation'",
        ).catch((execError) => {
          console.error("Error opening System Preferences:", execError);
        });
      }
    })
    .catch((error) => {
      console.error("Error showing permission dialog:", error);
    });
}

/**
 * Global hotkey registration and flow (includes both file capture and window show hotkeys)
 */
function setupGlobalHotkeys(): void {

  // Custom hotkey (Cmd+Shift+N)
  const customHotkey =
    process.platform === "darwin" ? "Cmd+Shift+N" : "Ctrl+Shift+N";
  const customHotkeyRegistered = globalShortcut.register(customHotkey, () => {
    console.log(
      `🔥 [HOTKEY] ${customHotkey} pressed - calling custom handler...`,
    );
    handleCustomHotkey();
  });

  if (!customHotkeyRegistered) {
    console.error(
      `🔥 [HOTKEY] Failed to register custom hotkey: ${customHotkey}`,
    );
  } else {
    console.log(`🔥 [HOTKEY] Custom hotkey registered: ${customHotkey}`);
  }

  // Turn off all media hotkey (Cmd+Shift+M)
  const turnOffAllMediaHotkey =
    process.platform === "darwin" ? "Cmd+Shift+M" : "Ctrl+Shift+M";
  const turnOffAllMediaRegistered = globalShortcut.register(
    turnOffAllMediaHotkey,
    () => {
      console.log(
        `🔥 [HOTKEY] ${turnOffAllMediaHotkey} pressed - turning off all media...`,
      );
      handleTurnOffAllMediaHotkey();
    },
  );

  if (!turnOffAllMediaRegistered) {
    console.error(
      `🔥 [HOTKEY] Failed to register turn off all media hotkey: ${turnOffAllMediaHotkey}`,
    );
  } else {
    console.log(
      `🔥 [HOTKEY] Turn off all media hotkey registered: ${turnOffAllMediaHotkey}`,
    );
  }
}

/**
 * Set default window position (bottom center of screen)
 */
function setDefaultWindowPosition(): void {
  if (!mainWindow) {
    console.error("Main window not available");
    return;
  }

  try {
    const { width: screenWidth, height: screenHeight } =
      screen.getPrimaryDisplay().workAreaSize;
    const dynamicWindowHeight = mainWindow.getBounds().height || windowHeight;

    const x = Math.floor((screenWidth - windowWidth) / 2);
    const y = screenHeight - dynamicWindowHeight - 50; // 50px margin from bottom

    mainWindow.setBounds(
      { x, y, width: windowWidth, height: dynamicWindowHeight },
      false,
    );
    console.log(`Window positioned at default bottom center: : x=${x}, y=${y}`);
  } catch (error) {
    console.error("Error setting default window position:", error);
  }
}

/**
 * Setup position memory system to remember where user drags the window
 */
function setupPositionMemory(): void {
  if (!mainWindow) return;

  // Save position when window is moved by user
  mainWindow.on("move", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      rememberedPosition = mainWindow.getBounds();
      console.log(
        `Window position remembered: x=${rememberedPosition.x}, y=${rememberedPosition.y}`,
      );
    }
  });

  // Save position when window is resized by user
  mainWindow.on("resize", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      rememberedPosition = mainWindow.getBounds();
      console.log(
        `Window size remembered: width=${rememberedPosition.width}, height=${rememberedPosition.height}`,
      );
    }
  });
}

/**
 * Prevent implicit maximize/zoom behaviors (e.g., double-click on draggable area)
 */
function setupWindowZoomPrevention(): void {
  if (!mainWindow) return;

  // Guard against maximize
  mainWindow.on("maximize", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.unmaximize();
    }
  });

  // Guard against entering fullscreen via system gestures
  mainWindow.on("enter-full-screen", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setFullScreen(false);
    }
  });
}

/**
 * Handle custom hotkey press (Cmd+Shift+N)
 */
function handleCustomHotkey(): void {
  if (!mainWindow) {
    console.error("Main window not available");
    return;
  }

  try {
    console.log("Custom hotkey (Cmd+Shift+N) pressed - sending to renderer...");
    mainWindow.webContents.send("custom-hotkey-pressed");
  } catch (error) {
    console.error("Error handling custom hotkey:", error);
  }
}

/**
 * Handle turn off all media hotkey press (Cmd+Shift+M)
 */
function handleTurnOffAllMediaHotkey(): void {
  if (!mainWindow) {
    console.error("Main window not available");
    return;
  }

  try {
    console.log(
      "Turn off all media hotkey (Cmd+Shift+M) pressed - sending to renderer...",
    );
    mainWindow.webContents.send("hotkey-turn-off-all-media");
  } catch (error) {
    console.error("Error handling turn off all media hotkey:", error);
  }
}

/**
 * Toggle between pill and full interface mode (for tray clicks)
 */
function toggleInterfaceMode(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    console.log(
      "Main window not available or destroyed - reinitializing app...",
    );
    // Recreate the menubar and window
    initializeMenuBar();
    return;
  }

  try {
    console.log("Toggling interface mode via IPC to renderer...");
    mainWindow.webContents.send("toggle-interface-mode");
  } catch (error) {
    console.error("Error toggling interface mode:", error);
  }
}

/**
 * Setup window handlers and IPC communication
 */
function setupWindowHandlers(): void {
  // Add IPC handler to reset position to default
  ipcMain.on("reset-window-position", () => {
    console.log("Reset window position request received from renderer");
    rememberedPosition = null;
    setDefaultWindowPosition();
  });
}

function cleanupGlobalShortcuts(): void {
  globalShortcut.unregisterAll();
}

// -------------------- WEBSOCKET SERVER --------------------

let lastUpdatedTimestamp = 0;

/**
 * Request active tab data from Chrome extension with retry logic
 */
const requestActiveTabDataFromExtension = async (): Promise<void> => {
  const maxRetries = 3;
  const retryDelay = 1000; // 1 second

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Check if we have any connected WebSocket clients
      if (wsClients.size === 0) {
        console.log(
          `Attempt ${attempt}/${maxRetries}: No Chrome extension connected`,
        );
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
          continue;
        }
        throw new Error("No Chrome extension connected");
      }

      // Send request to all connected clients
      const requestMessage = JSON.stringify({
        type: "requestActiveTabData",
        timestamp: Date.now(),
      });

      let messageSent = false;
      wsClients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(requestMessage);
          messageSent = true;
        } else {
          wsClients.delete(ws);
        }
      });

      if (!messageSent) {
        throw new Error("No active WebSocket connections");
      }

      console.log(
        `Successfully requested active tab data from Chrome extension (attempt ${attempt}/${maxRetries})`,
      );
      return; // Success, exit retry loop
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `Attempt ${attempt}/${maxRetries} failed to request active tab data:`,
        errorMessage,
      );

      if (attempt < maxRetries) {
        console.log(`Retrying in ${retryDelay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      } else {
        console.error("All retry attempts failed to request active tab data");
      }
    }
  }
};

const setupWebSocketServer = (): void => {
  wss = new (require("ws").Server)({ port: WEBSOCKET_PORT });
  console.log(`WebSocket server running on port ${WEBSOCKET_PORT}`);

  wss.on("connection", (ws: WebSocket) => {
    console.log("Chrome extension connected");
    const wasDisconnected = wsClients.size === 0;
    wsClients.add(ws);

    // Request active tab data when WebSocket transitions from disconnected to connected
    // and both session and LLM are in favorable states
    if (wasDisconnected && !globalPauseState && globalLlmConnectionState) {
      console.log(
        "WebSocket connected with session active and LLM connected - requesting active tab data",
      );
      requestActiveTabDataFromExtension().catch((error) => {
        console.error(
          "Failed to request active tab data on WebSocket connection:",
          error,
        );
      });
    }

    ws.on("message", (message: string) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === "ping") {
          ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
        } else if (data.type === "youtubeVideoUpdate") {
          if (Date.now() - lastUpdatedTimestamp > 500) {
            console.log("Processing YouTube Video");
            // fileProcessingService.processYouTubeVideo(data.youtubeData);
            lastUpdatedTimestamp = Date.now();
          }
        } else if (data.type === "tabDataUpdate") {
          if (Date.now() - lastUpdatedTimestamp > 500) {
            // fileProcessingService.processTabData(data.pageData);
            lastUpdatedTimestamp = Date.now();
          }
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    });

    ws.on("close", () => {
      console.log("Chrome extension disconnected");
      wsClients.delete(ws);
    });

    ws.on("error", (error: Error) => {
      console.error("WebSocket error:", error);
      wsClients.delete(ws);
    });
  });

  wss.on("error", (error) => {
    console.error("WebSocket Server error:", error);
  });

  startHeartbeat();
};

const startHeartbeat = (): void => {
  if (heartbeatInterval) clearInterval(heartbeatInterval);

  heartbeatInterval = setInterval(() => {
    if (wsClients.size > 0) {
      const pingMessage = JSON.stringify({
        type: "ping",
        timestamp: Date.now(),
      });
      wsClients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(pingMessage);
        } else {
          wsClients.delete(ws);
        }
      });

      if (wsClients.size === 0) {
        console.log("WebSocket server disconnected");
      }
    }
  }, 3000);
};

// -------------------- STREAMING HOTKEYS (SIMPLE TOGGLE) --------------------

function registerSimpleStreamingHotkeys(): void {
  const audioHotkey =
    process.platform === "darwin" ? "Cmd+Shift+A" : "Ctrl+Shift+A";
  const videoHotkey =
    process.platform === "darwin" ? "Cmd+Shift+S" : "Ctrl+Shift+S";

  const audioRegistered = globalShortcut.register(audioHotkey, () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send("hotkey-audio", { action: "toggle" });
    console.log(`🔥 [HOTKEY] Audio toggle via ${audioHotkey}`);
  });
  if (!audioRegistered) {
    console.error(`Failed to register audio hotkey: ${audioHotkey}`);
  }

  const videoRegistered = globalShortcut.register(videoHotkey, () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send("hotkey-video", { action: "toggle" });
    console.log(`🔥 [HOTKEY] Video toggle via ${videoHotkey}`);
  });
  if (!videoRegistered) {
    console.error(`Failed to register video hotkey: ${videoHotkey}`);
  }
}
