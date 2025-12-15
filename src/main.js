const { app, BrowserWindow, Tray, Menu, screen } = require('electron');
const path = require('path');
const fs = require('fs'); // 引入文件系统模块
let mainWindow;
let tray;

function createWindow() {
    // 获取主屏幕尺寸
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    mainWindow = new BrowserWindow({
        width: width,
        height: height,
        x: 0,
        y: 0,
        transparent: true,      // 关键：透明
        frame: false,           // 关键：无边框
        hasShadow: false,       // 去掉阴影
        alwaysOnTop: true,      // 关键：置顶
        skipTaskbar: true,      // 不在任务栏显示
        resizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // 【核心】设置鼠标穿透
    // forward: true 表示鼠标事件会传递给桌面底层的应用
    // 这样吃豆人在跑，您照样可以写代码、点网页
    mainWindow.setIgnoreMouseEvents(true, { forward: true });

    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    // 防止垃圾回收导致窗口关闭（虽然在 electron 中通常不需要，但在某些逻辑下是好习惯）
    mainWindow.on('closed', () => mainWindow = null);
}

function createTray() {
    // 图片放在 src 目录下，和 main.js 同级
    const iconPath = path.join(__dirname, 'icon.png');

    // 【后端习惯】防御性编程：先检查文件存不存在
    if (!fs.existsSync(iconPath)) {
        console.error('错误：找不到图标文件 ->', iconPath);
        return; // 如果没图，就不创建托盘了，防止程序崩溃
    }

    // 创建托盘实例
    try {
        tray = new Tray(iconPath);

        const contextMenu = Menu.buildFromTemplate([
            { label: '复位吃豆人', click: () => mainWindow.reload() }, // 加个刷新功能以防卡死
            { type: 'separator' }, // 分割线
            { label: '退出', click: () => app.quit() }
        ]);

        tray.setToolTip('桌面吃豆人 (Running)');
        tray.setContextMenu(contextMenu);

        // 这是一个好习惯：点击托盘图标可以切换显示/隐藏（可选）
        tray.on('click', () => {
            mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
        });

    } catch (e) {
        console.error("创建托盘失败:", e);
    }
}

app.whenReady().then(() => {
    // 这里的顺序很重要：先出窗口，再出托盘
    createWindow();
    createTray(); // <--- 记得这里要取消注释
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});