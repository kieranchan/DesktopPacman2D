const { app, BrowserWindow, Tray, Menu, screen, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const config = require('./config');

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

function forEachAliveWindow(fn) {
    for (const win of windows.values()) {
        if (!win.isDestroyed()) fn(win);
    }
}

function setAllWindowsVisible(visible) {
    forEachAliveWindow(win => visible ? win.show() : win.hide());
}

function anyWindowVisible() {
    for (const win of windows.values()) {
        if (!win.isDestroyed() && win.isVisible()) return true;
    }
    return false;
}

function broadcastConfig() {
    const cfg = config.get();
    forEachAliveWindow(win => win.webContents.send('runtime:config', cfg));
}

function broadcastReset() {
    forEachAliveWindow(win => win.webContents.send('runtime:reset'));
}

function syncAutoStart() {
    if (process.platform === 'darwin' || process.platform === 'win32') {
        app.setLoginItemSettings({ openAtLogin: !!config.get().autoStart });
    }
}

function updateConfig(partial) {
    config.update(partial);
    syncAutoStart();
    broadcastConfig();
    rebuildTrayMenu();
}

function showAbout() {
    dialog.showMessageBox({
        type: 'info',
        title: '关于 DesktopPacman2D',
        message: 'DesktopPacman2D',
        detail: '一个非干扰式桌面吃豆人覆盖层\nElectron + Canvas 2D + 复古 CRT 滤镜\nMIT License'
    });
}

function approxEq(a, b, eps = 0.001) {
    return Math.abs(a - b) < eps;
}

function rebuildTrayMenu() {
    if (!tray || tray.isDestroyed()) return;
    const cfg = config.get();

    const speedItem = (label, value) => ({
        label, type: 'radio', checked: approxEq(cfg.speedMultiplier, value),
        click: () => updateConfig({ speedMultiplier: value })
    });
    const dotItem = (label, value) => ({
        label, type: 'radio', checked: cfg.dotCount === value,
        click: () => updateConfig({ dotCount: value })
    });
    const crtItem = (label, enabled, strength) => ({
        label, type: 'radio',
        checked: cfg.crtEnabled === enabled && approxEq(cfg.crtStrength, strength),
        click: () => updateConfig({ crtEnabled: enabled, crtStrength: strength })
    });

    const template = [
        { label: '复位吃豆人', click: () => broadcastReset() },
        { label: anyWindowVisible() ? '隐藏窗口' : '显示窗口',
          click: () => { setAllWindowsVisible(!anyWindowVisible()); rebuildTrayMenu(); } },
        { type: 'separator' },
        { label: cfg.paused ? '恢复' : '暂停',
          click: () => updateConfig({ paused: !cfg.paused }) },
        { label: '速度', submenu: [
            speedItem('0.5x 慢速', 0.5),
            speedItem('1.0x 正常', 1.0),
            speedItem('1.5x 快速', 1.5),
            speedItem('2.0x 极速', 2.0)
        ]},
        { label: '豆子数量', submenu: [
            dotItem('稀疏 (15)', 15),
            dotItem('正常 (30)', 30),
            dotItem('密集 (60)', 60)
        ]},
        { label: 'CRT 效果', submenu: [
            crtItem('关闭', false, 0.0),
            crtItem('弱', true, 0.1),
            crtItem('标准', true, 0.2),
            crtItem('强', true, 0.35)
        ]},
        { type: 'separator' },
        { label: '开机自启', type: 'checkbox', checked: cfg.autoStart,
          click: () => updateConfig({ autoStart: !cfg.autoStart }) },
        { type: 'separator' },
        { label: '关于', click: () => showAbout() },
        { label: '退出', click: () => app.quit() }
    ];

    tray.setContextMenu(Menu.buildFromTemplate(template));
    tray.setToolTip(cfg.paused ? '桌面吃豆人 (已暂停)' : '桌面吃豆人 (运行中)');
}

function createTray() {
    const iconPath = path.join(__dirname, 'icon.png');
    if (!fs.existsSync(iconPath)) {
        console.error('Tray icon missing ->', iconPath);
        return;
    }
    try {
        tray = new Tray(iconPath);
        tray.on('click', () => {
            setAllWindowsVisible(!anyWindowVisible());
            rebuildTrayMenu();
        });
        rebuildTrayMenu();
    } catch (e) {
        console.error('Failed to create tray:', e);
    }
}

app.whenReady().then(() => {
    config.init(app.getPath('userData'));
    syncAutoStart();

    ipcMain.handle('runtime:get-config', () => config.get());

    createAllWindows();
    createTray();

    // Monitor hotplug handling.
    screen.on('display-added', (_event, newDisplay) => {
        if (!windows.has(newDisplay.id)) {
            createWindowForDisplay(newDisplay);
            // Newly added displays need the current config on load.
        }
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

app.on('before-quit', () => {
    config.flush();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
