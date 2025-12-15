# DesktopPacman2D

DesktopPacman2D 是一个基于 Electron 的桌面宠物/屏保类应用。它在您的桌面上渲染一个全屏、透明、无边框的覆盖层，运行一个自动演示的“吃豆人”模拟场景。

该应用设计为“非干扰式”，窗口支持鼠标穿透，因此您可以在欣赏复古 CRT 风格动画的同时正常操作桌面下的其他窗口。

## 功能特性

*   **桌面覆盖 (Overlay)**: 全屏透明窗口，无边框设计。
*   **鼠标穿透**: 窗口默认忽略鼠标事件，不会阻挡您点击桌面图标或操作其他软件。
*   **自动模拟**: 吃豆人 (Pac-Man) 和幽灵 (Ghosts) 由 AI 自动控制，无需玩家干预。
*   **复古风格**: 内置 CRT 扫描线滤镜效果，营造怀旧终端氛围。
*   **系统托盘**: 提供托盘图标，支持“重置动画”和“退出程序”操作。

## 安装与运行

确保您的系统中已安装 [Node.js](https://nodejs.org/)。

1.  **克隆或下载项目** 到本地目录。

2.  **安装依赖**
    由于 `package.json` 尚未包含 electron 依赖，请运行以下命令安装 Electron：
    ```bash
    npm install electron --save-dev
    ```

3.  **启动应用**
    ```bash
    npm start
    ```

## 项目结构

*   **`src/main.js` (主进程)**
    *   负责创建应用窗口。
    *   配置窗口属性：透明 (`transparent: true`)、无边框 (`frame: false`)、置顶 (`alwaysOnTop: true`)。
    *   设置 `setIgnoreMouseEvents(true, { forward: true })` 以实现鼠标穿透。
    *   创建系统托盘菜单。

*   **`src/renderer.js` (渲染进程)**
    *   包含所有视觉逻辑和模拟算法。
    *   `Director` 类：管理游戏循环和实体。
    *   `ClassicPacman` / `ClassicGhost` 类：实现角色的 AI 移动逻辑。
    *   `drawCRTOverlay`：绘制复古扫描线效果。

*   **`src/index.html`**
    *   渲染进程的宿主页面，加载 `renderer.js`。

## 操作说明

*   **退出**: 在系统托盘区域找到应用图标（通常在右下角），右键点击并选择 **Quit**。
*   **重置**: 在托盘图标菜单中选择 **Reset** 可重新加载动画。
