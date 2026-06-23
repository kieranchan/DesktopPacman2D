# DesktopPacman2D

DesktopPacman2D 是一个基于 Electron 的桌面装饰/屏保类应用。它在你的桌面上渲染一个全屏、透明、无边框的覆盖层，运行一个 AI 自动控制的"吃豆人"模拟场景，并叠加复古 CRT 扫描线效果。

应用设计为**非干扰式**：窗口默认鼠标穿透，欣赏动画的同时可以正常操作桌面下方的所有窗口与图标。

## 功能特性

- **桌面覆盖 (Overlay)**：全屏透明、无边框、始终置顶。
- **多显示器**：每块屏幕自动一个独立覆盖层，支持监视器热插拔。
- **覆盖任务栏**：使用 `display.bounds` 而非 `workAreaSize`，吃豆人可以跑遍整个屏幕（包括任务栏所在区域）。
- **鼠标穿透**：默认忽略所有鼠标事件，不会阻挡你点击桌面图标或操作其他软件。
- **自动模拟**：吃豆人 (Pac-Man) 和四只幽灵 (Ghosts) 由 AI 自主控制——吃豆人会优先追大力丸、躲避幽灵；幽灵在普通状态下追击吃豆人、受惊状态下逃跑。
- **复古风格**：内置可调强度的 CRT 扫描线滤镜与系统日志风格的滚动文字，营造怀旧终端氛围。
- **系统托盘菜单**：复位、显示/隐藏、暂停/恢复、速度档位（0.5×～2×）、豆子密度、CRT 强度、开机自启、关于、退出。
- **配置持久化**：所有设置写入 `userData/pacman-config.json`，下次启动自动恢复。
- **安全的渲染层**：开启 `contextIsolation`、关闭 `nodeIntegration`，通过 `preload.js` 提供受控的 `window.petAPI` 桥接。

## 安装与运行（开发模式）

确保已安装 [Node.js](https://nodejs.org/)（推荐 18+）。

```bash
npm install        # 安装依赖（electron + electron-builder）
npm start          # 启动应用
```

启动后吃豆人即出现在屏幕上自动跑动；右下角任务栏会出现托盘图标，右键即可调出全部菜单。

## 打包发布

仓库已集成 `electron-builder`，可直接构建可分发的 Windows 安装包或单文件便携版：

```powershell
npm run build:dir            # 解包到 dist/win-unpacked/（最快，用于本地验证）
npm run build:win:portable   # 单文件 portable .exe，约 87 MB
npm run build:win            # 同时生成 portable + NSIS 安装器
```

产物落地在 `dist/` 目录。`portable` 版双击即跑，无需安装、无需 Node.js；NSIS 安装器支持自定义安装路径。

> 注：Electron 42 的应用本体较大（解包后约 220 MB，portable 压缩到约 87 MB），这是 Electron 框架本身的体积，与本项目代码无关。

## 监控式测试脚本

为防止反复测试时 electron 进程堆积导致内存溢出，仓库内附带两个 PowerShell 监控脚本：

- `scripts/test-launch.ps1` — 测试开发模式 (`npm start`)
- `scripts/test-built.ps1` — 测试打包后的 `dist/win-unpacked/DesktopPacman2D.exe`

```powershell
npm run test:launch                                                        # 默认 8s
powershell -ExecutionPolicy Bypass -File scripts/test-launch.ps1 -Seconds 30 -MaxMemMB 600
powershell -ExecutionPolicy Bypass -File scripts/test-built.ps1  -Seconds 8
```

脚本逻辑：

1. 启动前先杀掉所有遗留 electron 进程（避免反复启动导致堆积）。
2. 每秒采样进程数和总工作集内存。
3. 进程数 > `MaxProcs`（默认 10）或内存 > `MaxMemMB`（默认 600 MB）→ 立即强制结束并报错退出。
4. 跑满 `-Seconds`（默认 8）后强制清理所有进程并打印采样报告。

经 30 秒长测，应用稳态约 4 个进程、~322 MB 工作集，无可见泄漏。

## 项目结构

```
DesktopPacman2D/
├── package.json
├── scripts/
│   ├── test-launch.ps1     # 监控启动（dev 模式）
│   └── test-built.ps1      # 监控启动（打包产物）
├── dist/                   # 构建输出（gitignored）
└── src/
    ├── main.js             # 主进程：窗口、托盘、IPC、配置加载
    ├── preload.js          # contextBridge 桥：window.petAPI
    ├── config.js           # JSON 持久化（防抖写盘 + 退出 flush）
    ├── index.html
    ├── icon.png            # 托盘图标（512×512，构建时自动转 .ico）
    └── renderer/
        ├── index.js        # 渲染入口（ES module）
        ├── constants.js    # CONFIG / PALETTE
        ├── vec2.js         # 向量库
        ├── pacman.js       # ClassicPacman
        ├── ghost.js        # ClassicGhost
        └── director.js     # 游戏循环 + 配置应用 + CRT
```

### 主进程 `src/main.js`

- 通过 `screen.getAllDisplays()` 给每个显示器创建一个独立的透明覆盖窗口；监听 `display-added` / `display-removed` / `display-metrics-changed` 实现监视器热插拔。
- 窗口属性：`transparent / frame: false / hasShadow: false / alwaysOnTop / skipTaskbar / focusable: false / resizable: false`。
- `setIgnoreMouseEvents(true, { forward: true })` 实现鼠标穿透。
- 启动时从 `userData/pacman-config.json` 读取上次的配置，托盘菜单变更后立即持久化并广播给所有渲染窗口。
- `webPreferences`: `preload + contextIsolation: true + nodeIntegration: false`。

### Preload `src/preload.js`

- `contextBridge.exposeInMainWorld('petAPI', { onConfig, onReset, onPaused, onCrt, requestInitialConfig })`
- 主进程 → 渲染进程的事件订阅 API；渲染进程没有任何直接 `require` Node 模块的能力。

### 渲染进程 `src/renderer/`

- `Director`：游戏主循环，管理实体、绘制世界、绘制 CRT 后处理层、滚动系统日志；订阅 `window.petAPI` 接收运行时配置变更与重置命令。
- `ClassicPacman`：steering-behavior AI——seek 最近的豆子（大力丸优先级加权）、近距离 flee 幽灵、靠近边界时反向推。
- `ClassicGhost`：普通状态 seek 吃豆人；吃豆人吃了大力丸后切换为 flee；幽灵之间互相 separate 防止挤一起。
- `drawCRTOverlay`：每 3px 一条横线、偶发绿色屏幕闪烁，模拟阴极射线管屏幕；强度跟随 `config.crtStrength`。

## 操作说明

右键单击右下角托盘图标即可调出完整菜单：

| 菜单项 | 行为 |
|--------|------|
| 复位吃豆人 | 重置所有渲染窗口的世界（重新初始化角色和豆子） |
| 显示/隐藏窗口 | 隐藏全部覆盖窗口；再点恢复 |
| 暂停 / 恢复 | 暂停后只渲染不更新，CPU 接近 0 |
| 速度 | 0.5× / 1× / 1.5× / 2× （影响吃豆人与幽灵的速度上限） |
| 豆子数量 | 稀疏 15 / 正常 30 / 密集 60 |
| CRT 效果 | 关闭 / 弱 / 标准 / 强 |
| 开机自启 | 切换 Windows 登录项 |
| 关于 | 显示版本与说明对话框 |
| 退出 | 关闭应用 |

单击托盘图标可在显示/隐藏之间快速切换。

## 许可证

MIT
