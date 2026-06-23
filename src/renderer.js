// ==========================================
// 📟 配置：黑客终端 / CRT风格
// ==========================================
const CONFIG = {
    pacSpeed: 180,
    ghostSpeed: 140,
    fleeSpeed: 100,
    dotCount: 30,
    crtStrength: 0.2, // CRT 扫描线强度
};

// 高对比度终端色板
const PALETTE = {
    pacman: '#FFFF00', // 经典黄
    // 幽灵色需要稍微调整以适应高对比度，更像电子信号
    ghosts: [
        '#FF0000', // Blinky (红)
        '#FF69B4', // Pinky (热粉)
        '#00FFFF', // Inky (青色信号)
        '#FF8C00'  // Clyde (琥珀色)
    ],
    frightened: '#0000FF', // 受惊蓝
    frightenedFlash: '#FFFFFF',
    dot: '#00FF00',    // 终端绿豆子 (像数据点)
    power: '#FFB000',  // 琥珀色大力丸 (像警告信号)
    text: '#00FF00'    // 系统日志颜色
};

// 简单的向量库 (保持不变)
const Vec2 = {
    add: (v1, v2) => ({ x: v1.x + v2.x, y: v1.y + v2.y }),
    sub: (v1, v2) => ({ x: v1.x - v2.x, y: v1.y - v2.y }),
    mult: (v, n) => ({ x: v.x * n, y: v.y * n }),
    mag: (v) => Math.sqrt(v.x * v.x + v.y * v.y),
    normalize: (v) => {
        const m = Vec2.mag(v);
        return m === 0 ? { x: 0, y: 0 } : { x: v.x / m, y: v.y / m };
    },
    dist: (v1, v2) => Math.sqrt(Math.pow(v2.x - v1.x, 2) + Math.pow(v2.y - v1.y, 2)),
    limit: (v, max) => {
        const m = Vec2.mag(v);
        return m > max ? Vec2.mult(v, max / m) : v;
    }
};

// ==========================================
// 🖥️ 导演：CRT终端控制器
// ==========================================
class Director {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        // 关闭平滑，追求像素感
        this.ctx.imageSmoothingEnabled = false;
        document.body.appendChild(this.canvas);

        this.width = window.innerWidth;
        this.height = window.innerHeight;

        this.actors = { pacman: null, ghosts: [], dots: [], logs: [] };
        this.gameTime = 0;

        // Runtime-tunable config (mirrors src/config.js DEFAULTS).
        this.config = {
            paused: false,
            crtEnabled: true,
            crtStrength: CONFIG.crtStrength,
            speedMultiplier: 1.0,
            dotCount: CONFIG.dotCount
        };

        if (window.petAPI) {
            window.petAPI.onConfig(cfg => this.applyConfig(cfg));
            window.petAPI.onReset(() => this.resetWorld());
            window.petAPI.requestInitialConfig()
                .then(cfg => this.applyConfig(cfg))
                .catch(() => {});
        }

        this.resize();
        window.addEventListener('resize', () => this.resize());

        setTimeout(() => {
            this.resize();
            this.initWorld();
            this.lastTime = performance.now();
            // 开局打印系统日志
            this.logSystem("SYS.BOOT", "KERNEL PANIC: GHOST_PROCESS DETECTED");
            requestAnimationFrame(t => this.loop(t));
        }, 100);
    }

    applyConfig(cfg) {
        if (!cfg || typeof cfg !== 'object') return;
        const next = { ...this.config };
        for (const key of Object.keys(this.config)) {
            if (key in cfg) next[key] = cfg[key];
        }
        // If dotCount shrank, trim immediately so the world responds visibly.
        if (next.dotCount < this.actors.dots.length) {
            this.actors.dots.length = next.dotCount;
        }
        const wasPaused = this.config.paused;
        this.config = next;
        if (wasPaused && !next.paused) {
            // Avoid a giant dt spike after resuming.
            this.lastTime = performance.now();
        }
    }

    resetWorld() {
        this.actors = { pacman: null, ghosts: [], dots: [], logs: [] };
        this.initWorld();
        this.logSystem("SYS.RESET", "WORLD REINITIALIZED");
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }

    initWorld() {
        const cx = this.width / 2 || 500;
        const cy = this.height / 2 || 300;
        this.actors.pacman = new ClassicPacman(cx, cy);

        PALETTE.ghosts.forEach((c, i) => {
            const gx = i % 2 === 0 ? 100 : this.width - 100;
            const gy = i < 2 ? 100 : this.height - 100;
            this.actors.ghosts.push(new ClassicGhost(gx, gy, c));
        });

        for(let i=0; i<this.config.dotCount; i++) this.spawnDot();
    }

    spawnDot() {
        const pad = 50;
        const x = Math.random() * (this.width - pad*2) + pad;
        const y = Math.random() * (this.height - pad*2) + pad;
        // 大力丸是数据溢出信号
        this.actors.dots.push({ pos: {x,y}, isPower: Math.random() < 0.05, size: 6 });
    }

    // 像系统日志一样打印信息
    logSystem(type, msg) {
        this.actors.logs.push({
            text: `[${type}] ${msg}`,
            y: this.height - 50, // 从底部向上飘
            life: 3.0
        });
    }

    loop(timestamp) {
        const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
        this.lastTime = timestamp;

        this.ctx.clearRect(0, 0, this.width, this.height);

        if (!this.config.paused) {
            this.gameTime += dt;
            if (this.actors.dots.length < this.config.dotCount) this.spawnDot();
            this.actors.pacman.update(dt, this);
            this.actors.ghosts.forEach(g => g.update(dt, this));
            this.updateLogs(dt);
        }

        // 渲染层
        this.drawWorld();

        if (this.config.crtEnabled && this.config.crtStrength > 0) {
            this.drawCRTOverlay();
        }

        requestAnimationFrame(t => this.loop(t));
    }

    updateLogs(dt) {
        for (let i = this.actors.logs.length - 1; i >= 0; i--) {
            const log = this.actors.logs[i];
            log.y -= 20 * dt; // 向上滚动
            log.life -= dt;
            if (log.life <= 0) this.actors.logs.splice(i, 1);
        }
    }

    drawWorld() {
        // 绘制豆子 (数据点) - 方形像素点
        this.actors.dots.forEach(d => {
            this.ctx.fillStyle = d.isPower ? PALETTE.power : PALETTE.dot;
            const s = d.isPower ? d.size * 2 : d.size;
            // 绘制矩形而不是圆形，更像像素
            this.ctx.fillRect(d.pos.x - s/2, d.pos.y - s/2, s, s);

            // 大力丸闪烁外框
            if (d.isPower && Math.floor(this.gameTime*10)%2===0) {
                this.ctx.strokeStyle = PALETTE.power;
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(d.pos.x - s, d.pos.y - s, s*2, s*2);
            }
        });

        // 绘制角色
        this.actors.pacman.draw(this.ctx);
        this.actors.ghosts.forEach(g => g.draw(this.ctx, this.actors.pacman));

        // 绘制系统日志 (终端字体)
        this.ctx.font = "bold 16px 'Courier New', Consolas, monospace";
        this.ctx.textAlign = "left";
        this.actors.logs.forEach((log, i) => {
            // 闪烁光标效果
            const cursor = Math.floor(this.gameTime*2)%2===0 ? '_' : ' ';

            // 计算透明度，让它看起来像旧屏幕的余辉消失
            this.ctx.fillStyle = PALETTE.text;
            this.ctx.globalAlpha = Math.min(log.life, 1) * 0.8;
            this.ctx.fillText(`> ${log.text}${i === this.actors.logs.length -1 ? cursor : ''}`, 50, log.y);
        });
        this.ctx.globalAlpha = 1;
    }

    // 【核心技术】绘制 CRT 扫描线
    drawCRTOverlay() {
        this.ctx.save();
        this.ctx.pointerEvents = 'none'; // 确保不阻挡任何东西

        // 1. 绘制横向扫描线
        this.ctx.fillStyle = `rgba(0, 0, 0, ${this.config.crtStrength})`;
        for (let y = 0; y < this.height; y += 3) {
            this.ctx.fillRect(0, y, this.width, 1);
        }

        // 2. 可选：轻微的屏幕闪烁 (Flicker)
        if (Math.random() > 0.95) {
            this.ctx.fillStyle = `rgba(0, 255, 0, 0.02)`;
            this.ctx.fillRect(0, 0, this.width, this.height);
        }

        this.ctx.restore();
    }
}

// ==========================================
// 🟡 经典 Pacman (回归本源)
// ==========================================
class ClassicPacman {
    constructor(x, y) {
        this.pos = { x, y };
        this.vel = { x: 0, y: 0 };
        this.radius = 18; // 稍微大一点
        this.angle = 0;
        this.mouthOpen = 0;
        this.powerTimer = 0;
    }

    update(dt, game) {
        const speed = CONFIG.pacSpeed * game.config.speedMultiplier;
        let steering = { x: 0, y: 0 };
        let target = null;
        let minDist = Infinity;
        // 优先吃大力丸
        game.actors.dots.forEach(d => {
            const dist = Vec2.dist(this.pos, d.pos);
            const score = dist - (d.isPower ? 1000 : 0);
            if (score < minDist) { minDist = score; target = d; }
        });
        if (target) {
            let desire = Vec2.normalize(Vec2.sub(target.pos, this.pos));
            desire = Vec2.mult(desire, speed);
            steering = Vec2.add(steering, Vec2.sub(desire, this.vel));
        }
        // 躲避
        if (this.powerTimer <= 0) {
            game.actors.ghosts.forEach(g => {
                const d = Vec2.dist(this.pos, g.pos);
                if (d < 150 && !g.dead) {
                    let flee = Vec2.normalize(Vec2.sub(this.pos, g.pos));
                    flee = Vec2.mult(flee, speed * 4);
                    steering = Vec2.add(steering, flee);
                }
            });
        }
        // 边界
        const m = 50;
        if (this.pos.x < m) steering.x += 300;
        if (this.pos.x > game.width - m) steering.x -= 300;
        if (this.pos.y < m) steering.y += 300;
        if (this.pos.y > game.height - m) steering.y -= 300;

        steering = Vec2.limit(steering, 15);
        this.vel = Vec2.add(this.vel, steering);
        this.vel = Vec2.limit(this.vel, speed);
        this.pos = Vec2.add(this.pos, Vec2.mult(this.vel, dt));

        if (Vec2.mag(this.vel) > 10) this.angle = Math.atan2(this.vel.y, this.vel.x);
        this.mouthOpen = Math.abs(Math.sin(Date.now() / 80)) * 0.25 * Math.PI;
        if (this.powerTimer > 0) this.powerTimer -= dt;
        this.checkCollision(game);
    }

    checkCollision(game) {
        // 吃豆
        for (let i = game.actors.dots.length - 1; i >= 0; i--) {
            const dot = game.actors.dots[i];
            // 碰撞判定稍微严格一点，像素感
            if (Vec2.dist(this.pos, dot.pos) < this.radius) {
                game.actors.dots.splice(i, 1);
                if (dot.isPower) {
                    this.powerTimer = 6.0;
                    game.logSystem("SYS.ALERT", "OVERDRIVE ENABLED (6s)");
                }
            }
        }
        // 碰鬼
        game.actors.ghosts.forEach(g => {
            if (g.dead) return;
            if (Vec2.dist(this.pos, g.pos) < this.radius + g.radius) {
                if (this.powerTimer > 0) {
                    g.die(game);
                } else {
                    game.logSystem("ERR.COLLISION", "ENTITY DAMAGE DETECTED");
                    this.pos.x = Math.random() * game.width;
                    this.pos.y = Math.random() * game.height;
                }
            }
        });
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.angle);

        // 经典形象，无光晕
        ctx.fillStyle = PALETTE.pacman;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, this.mouthOpen, Math.PI * 2 - this.mouthOpen);
        ctx.lineTo(0, 0);
        ctx.fill();

        // 增加一个像素化的硬边描边
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
    }
}

// ==========================================
// 👻 经典 Ghost (回归Sprite)
// ==========================================
class ClassicGhost {
    constructor(x, y, color) {
        this.pos = { x, y };
        this.vel = { x: 0, y: 0 };
        this.color = color;
        this.radius = 18;
        this.dead = false;
        this.timer = 0; // 用于动画
    }

    update(dt, game) {
        if (this.dead) return;
        this.timer += dt;

        const ghostSpeed = CONFIG.ghostSpeed * game.config.speedMultiplier;
        const fleeSpeed = CONFIG.fleeSpeed * game.config.speedMultiplier;
        let steering = { x: 0, y: 0 };
        if (game.actors.pacman.powerTimer > 0) {
            let flee = Vec2.normalize(Vec2.sub(this.pos, game.actors.pacman.pos));
            flee = Vec2.mult(flee, fleeSpeed);
            steering = Vec2.add(steering, flee);
        } else {
            let seek = Vec2.normalize(Vec2.sub(game.actors.pacman.pos, this.pos));
            seek = Vec2.mult(seek, ghostSpeed);
            steering = Vec2.add(steering, seek);
        }
        // 分离和边界
        game.actors.ghosts.forEach(other => {
            if(other !== this && !other.dead && Vec2.dist(this.pos,other.pos)<50)
                steering = Vec2.add(steering, Vec2.mult(Vec2.normalize(Vec2.sub(this.pos,other.pos)), 80));
        });
        const m = 50;
        if (this.pos.x < m || this.pos.x > game.width - m) steering.x *= -2;
        if (this.pos.y < m || this.pos.y > game.height - m) steering.y *= -2;

        steering = Vec2.limit(steering, 8);
        this.vel = Vec2.add(this.vel, steering);
        this.vel = Vec2.limit(this.vel, ghostSpeed);
        this.pos = Vec2.add(this.pos, Vec2.mult(this.vel, dt));
    }

    die(game) {
        this.dead = true;
        // 打印被隔离日志
        game.logSystem("SYS.PURGE", `PID_${Math.floor(Math.random()*9999)} ISOLATED`);
        setTimeout(() => {
            this.dead = false;
            this.pos = { x: Math.random()*game.width, y: Math.random()*game.height };
        }, 5000);
    }

    draw(ctx, target) {
        if (this.dead) return;
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);

        let isFrightened = target.powerTimer > 0;
        let drawColor = this.color;
        if (isFrightened) drawColor = (target.powerTimer < 2 && Math.floor(Date.now()/200)%2===0) ? PALETTE.frightenedFlash : PALETTE.frightened;

        // === 经典的 Sprite 绘制 ===
        ctx.fillStyle = drawColor;
        ctx.beginPath();
        // 头部圆弧
        ctx.arc(0, -4, this.radius, Math.PI, 0);
        // 脚部波浪 (使用 step 函数制造像素感)
        const r = this.radius;
        const frames = 4; // 4帧动画
        const step = Math.floor(this.timer * 8) % frames;
        const wiggle = (step % 2 === 0) ? 4 : 0;

        ctx.lineTo(r, r - wiggle);
        ctx.lineTo(r * 0.5, r + wiggle);
        ctx.lineTo(0, r - wiggle);
        ctx.lineTo(-r * 0.5, r + wiggle);
        ctx.lineTo(-r, r - wiggle);
        ctx.lineTo(-r, -4);
        ctx.fill();

        // 硬边描边
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 眼睛 (受惊时变成波浪嘴)
        if (isFrightened) {
            ctx.strokeStyle = PALETTE.dot; // 用终端绿画嘴
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-10, 8); ctx.lineTo(-5, 4); ctx.lineTo(0, 8); ctx.lineTo(5, 4); ctx.lineTo(10, 8);
            ctx.stroke();
        } else {
            ctx.fillStyle = '#FFF'; // 眼白
            ctx.beginPath(); ctx.arc(-7, -4, 6, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(7, -4, 6, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#000'; // 黑色眼珠 (像素感)
            const lx = this.vel.x > 0 ? 3 : -3;
            const ly = this.vel.y > 0 ? 3 : -3;
            ctx.fillRect(-9 + lx, -6 + ly, 4, 4);
            ctx.fillRect(5 + lx, -6 + ly, 4, 4);
        }

        ctx.restore();
    }
}

new Director();
