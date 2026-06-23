const { app, BrowserWindow, Tray, Menu, screen, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const PRELOAD_PATH = path.join(__dirname, 'preload.js');

// One transparent overlay window per display. Keyed by display.id so we can
// add/remove windows as the user plugs/unplugs monitors at runtime.
const windows = new Map();
let tray = null;

function createWindowForDisplay(display) {
    // Use bounds (full screen area including taskbar) instead of workAreaSize,
    // so pac-man can roam through the taskbar region as well.
    const { x, y, width, height } = display.bounds;

    const win = new BrowserWindow({
        x, y, width, height,
        transparent: true,
        frame: false,
        hasShadow: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        focusable: false,
        webPreferences: {
            preload: PRELOAD_PATH,
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false
        }
    });

    win.setIgnoreMouseEvents(true, { forward: true });
    win.loadFile(path.join(__dirname, 'index.html'));
    win.on('closed', () => windows.delete(display.id));

    windows.set(display.id, win);
    return win;
}

function createAllWindows() {
    for (const display of screen.getAllDisplays()) {
        createWindowForDisplay(display);
    }
}

function reloadAllWindows() {
    for (const win of windows.values()) {
        if (!win.isDestroyed()) win.reload();
    }
}

function setAllWindowsVisible(visible) {
    for (const win of windows.values()) {
        if (win.isDestroyed()) continue;
        if (visible) win.show(); else win.hide();
    }
}

function anyWindowVisible() {
    for (const win of windows.values()) {
        if (!win.isDestroyed() && win.isVisible()) return true;
    }
    return false;
}

function createTray() {
    const iconPath = path.join(__dirname, 'icon.png');
    if (!fs.existsSync(iconPath)) {
        console.error('Tray icon missing ->', iconPath);
        return;
    }
    try {
        tray = new Tray(iconPath);
        const contextMenu = Menu.buildFromTemplate([
            { label: '复位吃豆人', click: () => reloadAllWindows() },
            { type: 'separator' },
            { label: '退出', click: () => app.quit() }
        ]);
        tray.setToolTip('桌面吃豆人 (Running)');
        tray.setContextMenu(contextMenu);
        tray.on('click', () => setAllWindowsVisible(!anyWindowVisible()));
    } catch (e) {
        console.error('Failed to create tray:', e);
    }
}

app.whenReady().then(() => {
    // IPC: renderer can ask for current config on load. For now this returns
    // an empty object; later tasks will populate it with persisted settings.
    ipcMain.handle('runtime:get-config', () => ({}));

    createAllWindows();
    createTray();

    // Handle monitor hotplug at runtime.
    screen.on('display-added', (_event, newDisplay) => {
        if (!windows.has(newDisplay.id)) createWindowForDisplay(newDisplay);
    });
    screen.on('display-removed', (_event, oldDisplay) => {
        const win = windows.get(oldDisplay.id);
        if (win && !win.isDestroyed()) win.close();
        windows.delete(oldDisplay.id);
    });
    screen.on('display-metrics-changed', (_event, changedDisplay) => {
        const win = windows.get(changedDisplay.id);
        if (win && !win.isDestroyed()) {
            const { x, y, width, height } = changedDisplay.bounds;
            win.setBounds({ x, y, width, height });
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
