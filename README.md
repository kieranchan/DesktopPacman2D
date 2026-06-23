# DesktopPacman2D

DesktopPacman2D 是一个基于 Electron 的桌面装饰/屏保类应用。它在你的桌面上渲染一个全屏、透明、无边框的覆盖层，运行一个 AI 自动控制的"吃豆人"模拟场景，并叠加复古 CRT 扫描线效果。

应用设计为**非干扰式**：窗口默认鼠标穿透，欣赏动画的同时可以正常操作桌面下方的所有窗口与图标。

## 功能特性

- **桌面覆盖 (Overlay)**：全屏透明、无边框、始终置顶。
- **鼠标穿透**：默认忽略所有鼠标事件，不会阻挡你点击桌面图标或操作其他软件。
- **自动模拟**：吃豆人 (Pac-Man) 和四只幽灵 (Ghosts) 由 AI 自主控制——吃豆人会优先追大力丸、躲避幽灵；幽灵在普通状态下追击吃豆人、受惊状态下逃跑。
- **复古风格**：内置 CRT 扫描线滤镜与系统日志风格的滚动文字，营造怀旧终端氛围。
- **系统托盘**：右下角托盘图标提供"复位吃豆人"和"退出"菜单；单击托盘图标可显示/隐藏窗口。

## 安装与运行

确保已安装 [Node.js](https://nodejs.org/)（推荐 18+）。

```bash
npm install        # 安装依赖（包含 electron）
npm start          # 启动应用
```

启动后吃豆人即出现在屏幕上自动跑动。

## 安全测试 / 监控启动

仓库内附带一个 PowerShell 监控脚本 `scripts/test-launch.ps1`，用于在迭代开发时安全地烟雾测试：

```powershell
npm run test:launch
# 或自定义参数
powershell -ExecutionPolicy Bypass -File scripts/test-launch.ps1 -Seconds 30 -MaxMemMB 600
```

脚本会：

1. 先杀掉所有遗留的 electron 进程（避免反复启动导致进程堆积）。
2. 启动应用并每秒采样进程数和总工作集内存。
3. 进程数 > `MaxProcs`（默认 10）或内存 > `MaxMemMB`（默认 600 MB）时立即强制结束。
4. 跑满 `-Seconds`（默认 8 秒）后自动清理并打印报告。

这样可以放心地反复测试，不必担心后台残留导致内存溢出。

## 项目结构

```
DesktopPacman2D/
├── package.json
├── scripts/
│   └── test-launch.ps1     # 监控式启动脚本（杀进程→采样→自动清理）
└── src/
    ├── main.js             # 主进程：透明窗口 + 鼠标穿透 + 系统托盘
    ├── renderer.js         # 渲染进程：Director/Pacman/Ghost + CRT 效果
    ├── index.html
    └── icon.png            # 托盘图标
```

### 主进程 `src/main.js`

- 创建透明 (`transparent: true`)、无边框 (`frame: false`)、置顶 (`alwaysOnTop: true`)、不在任务栏显示 (`skipTaskbar: true`) 的全屏 BrowserWindow。
- 调用 `setIgnoreMouseEvents(true, { forward: true })` 实现鼠标穿透。
- 检测托盘图标文件是否存在，创建系统托盘菜单。

### 渲染进程 `src/renderer.js`

- `Director`：游戏主循环，管理实体、绘制世界、绘制 CRT 后处理层、滚动系统日志。
- `ClassicPacman`：steering-behavior 风格的 AI——seek 最近的豆子（大力丸优先级加权）、近距离 flee 幽灵、靠近边界时反向推。
- `ClassicGhost`：普通状态 seek 吃豆人；吃豆人吃了大力丸后切换为 flee；幽灵之间互相 separate 防止挤一起。
- `drawCRTOverlay`：每 3px 一条黑色横线、偶发绿色屏幕闪烁，模拟阴极射线管屏幕。

## 操作说明

- **退出**：在系统托盘区域找到应用图标，右键点击并选择 **退出**。
- **复位**：托盘菜单中选择 **复位吃豆人**，会刷新渲染进程重新初始化。
- **显示/隐藏**：单击托盘图标可在显示和隐藏之间切换。

## 许可证

MIT
