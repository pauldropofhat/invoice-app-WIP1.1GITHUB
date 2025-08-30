// Minimal Electron bootstrap (no localhost) with safe cache handling
const { app, BrowserWindow, shell, session } = require("electron");
const path = require("path");

// Optional: sets a proper AppUserModelID on Windows (safe anytime)
app.setAppUserModelId("com.yourcompany.invoicer");

// Turn off HTTP/GPU caches in dev to avoid locked/AV-protected folders
app.commandLine.appendSwitch("disable-http-cache");
app.commandLine.appendSwitch("disk-cache-size", "0");
app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");

function createWindow() {
const win = new BrowserWindow({
  width: 1100,
  height: 800,
  webPreferences: {
    preload: path.join(__dirname, "preload.js"),
    contextIsolation: true,   // keep this on
    sandbox: false            // turn sandbox OFF so preload can load
     
  }
});



  // Load your built app
  win.loadFile(path.join(__dirname, "..", "dist", "index.html"));

  // Open external links in default apps
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (/^(https?:|mailto:)/i.test(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

app.whenReady().then(async () => {
  // Clear any existing cache once (ignore errors)
  try {
    await session.defaultSession.clearCache();
  } catch {}
  createWindow();
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

