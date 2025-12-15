// ==========================================
// 🎨 渲染核心与配置
// ==========================================
const CONFIG = {
    pacSpeed: 200,
    ghostSpeed: 160,
    ghostFleeSpeed: 100,
    pacHuntSpeed: 220,
    dotCount: 20,
    powerDotChance: 0.05
};

const COLORS = {
    pacman: '#FFFF00',
    wall: '#2121DE',
    dot: '#FFB8AE',
    powerDot: '#FFD700',
    ghosts: ['#FF0000', '#FFB8FF', '#00FFFF', '#FFB852'],
    frightened: '#0000FF',
    frightenedFlash: '#FFFFFF'
};

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
        if (m > max) return Vec2.mult(v, max / m);
        return v;
    }
};

class Director {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        document.body.appendChild(this.canvas);

        this.actors = {
            pacman: null,
            ghosts: [],
            dots: [],
            particles: [],
            popups: []
        };

        this.powerMode = false;
        this.powerTimer = 0;

        // 1. 先调整大小
        this.resize();

        // 2. 延迟 100ms 初始化世界，确保 Electron 窗口尺寸已就绪
        setTimeout(() => {
            this.resize(); // 再确认一次
            this.initWorld();
            this.lastTime = performance.now();
            requestAnimationFrame(t => this.loop(t));
        }, 100);

        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }

    initWorld() {
        console.log("Game Init - Size:", this.width, this.height);

        // 确保不在 0,0 出生
        const spawnX = this.width / 2 || 500;
        const spawnY = this.height / 2 || 300;

        this.actors.pacman = new Pacman(spawnX, spawnY);

        COLORS.ghosts.forEach((color, i) => {
            const x = i % 2 === 0 ? 50 : (this.width - 50);
            const y = i < 2 ? 50 : (this.height - 50);
            this.actors.ghosts.push(new Ghost(x, y, color));
        });

        for (let i = 0; i < CONFIG.dotCount; i++) this.spawnDot();
    }

    spawnDot() {
        const isPower = Math.random() < CONFIG.powerDotChance;
        const padding = 50;
        // 防止 width 为 0 时产生负数
        const safeW = Math.max(this.width - padding * 2, 100);
        const safeH = Math.max(this.height - padding * 2, 100);

        const x = Math.random() * safeW + padding;
        const y = Math.random() * safeH + padding;
        this.actors.dots.push(new Dot(x, y, isPower));
    }

    activatePowerMode() {
        this.powerMode = true;
        this.powerTimer = 8.0;
        this.actors.pacman.combo = 0;
    }

    spawnPopup(x, y, text, color) {
        this.actors.popups.push({ x, y, text, color, life: 1.0 });
    }

    spawnParticles(x, y, color) {
        for (let i = 0; i < 6; i++) {
            this.actors.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 200,
                vy: (Math.random() - 0.5) * 200,
                life: 0.5,
                color
            });
        }
    }

    loop(timestamp) {
        // 安全检查：如果还没初始化好，就跳过
        if (!this.actors.pacman) {
            requestAnimationFrame(t => this.loop(t));
            return;
        }

        const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
        this.lastTime = timestamp;

        this.ctx.clearRect(0, 0, this.width, this.height);

        if (this.powerMode) {
            this.powerTimer -= dt;
            if (this.powerTimer <= 0) this.powerMode = false;
        }

        if (this.actors.dots.length < CONFIG.dotCount) this.spawnDot();

        // Update
        try {
            this.actors.pacman.update(dt, this);
            this.actors.ghosts.forEach(g => g.update(dt, this));
        } catch (e) {
            console.error("Update Error:", e); // 捕获逻辑错误
        }

        // Particles & Popups
        for (let i = this.actors.particles.length - 1; i >= 0; i--) {
            const p = this.actors.particles[i];
            p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
            if (p.life <= 0) this.actors.particles.splice(i, 1);
        }
        for (let i = this.actors.popups.length - 1; i >= 0; i--) {
            const p = this.actors.popups[i];
            p.y -= 50 * dt; p.life -= dt;
            if (p.life <= 0) this.actors.popups.splice(i, 1);
        }

        // Draw
        try {
            this.actors.dots.forEach(d => d.draw(this.ctx));

            this.actors.particles.forEach(p => {
                this.ctx.fillStyle = p.color;
                this.ctx.globalAlpha = p.life * 2;
                this.ctx.beginPath(); this.ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); this.ctx.fill();
                this.ctx.globalAlpha = 1;
            });

            this.actors.pacman.draw(this.ctx);
            this.actors.ghosts.forEach(g => g.draw(this.ctx, this.powerMode, this.powerTimer));

            this.ctx.font = "bold 16px 'Courier New'";
            this.actors.popups.forEach(p => {
                this.ctx.fillStyle = p.color;
                this.ctx.fillText(p.text, p.x, p.y);
            });
        } catch (e) {
            console.error("Draw Error:", e); // 捕获绘制错误
        }

        requestAnimationFrame(t => this.loop(t));
    }
}

class Pacman {
    constructor(x, y) {
        this.pos = { x, y };
        this.vel = { x: 0, y: 0 };
        this.radius = 20;
        this.mouthOpen = 0;
        this.angle = 0;
        this.combo = 0;
    }

    update(dt, game) {
        let steering = { x: 0, y: 0 };
        let target = null;
        let minDist = Infinity;

        if (game.powerMode) {
            game.actors.ghosts.forEach(g => {
                if (!g.dead) {
                    const d = Vec2.dist(this.pos, g.pos);
                    if (d < minDist) { minDist = d; target = g; }
                }
            });
        }

        if (!target) {
            minDist = Infinity;
            game.actors.dots.forEach(d => {
                const dist = Vec2.dist(this.pos, d.pos);
                const score = dist - (d.isPower ? 500 : 0);
                if (score < minDist) { minDist = score; target = d; }
            });
        }

        if (target) {
            let desire = Vec2.sub(target.pos, this.pos);
            desire = Vec2.normalize(desire);
            const speed = game.powerMode ? CONFIG.pacHuntSpeed : CONFIG.pacSpeed;
            desire = Vec2.mult(desire, speed);
            const steer = Vec2.sub(desire, this.vel);
            steering = Vec2.add(steering, steer);
        }

        if (!game.powerMode) {
            game.actors.ghosts.forEach(g => {
                const d = Vec2.dist(this.pos, g.pos);
                if (d < 150 && !g.dead) {
                    let flee = Vec2.sub(this.pos, g.pos);
                    flee = Vec2.normalize(flee);
                    flee = Vec2.mult(flee, CONFIG.pacSpeed * 3);
                    steering = Vec2.add(steering, flee);
                }
            });
        }

        const margin = 50;
        if (this.pos.x < margin) steering.x += 200;
        if (this.pos.x > game.width - margin) steering.x -= 200;
        if (this.pos.y < margin) steering.y += 200;
        if (this.pos.y > game.height - margin) steering.y -= 200;

        steering = Vec2.limit(steering, 10);
        this.vel = Vec2.add(this.vel, steering);
        this.vel = Vec2.limit(this.vel, game.powerMode ? CONFIG.pacHuntSpeed : CONFIG.pacSpeed);

        this.pos = Vec2.add(this.pos, Vec2.mult(this.vel, dt));
        // 防止速度为0时角度计算错误
        if (Math.abs(this.vel.x) > 0.1 || Math.abs(this.vel.y) > 0.1) {
            this.angle = Math.atan2(this.vel.y, this.vel.x);
        }

        this.mouthOpen = Math.abs(Math.sin(Date.now() / 100)) * 0.25 * Math.PI;

        for (let i = game.actors.dots.length - 1; i >= 0; i--) {
            const dot = game.actors.dots[i];
            if (Vec2.dist(this.pos, dot.pos) < this.radius + dot.radius) {
                game.actors.dots.splice(i, 1);
                if (dot.isPower) {
                    game.activatePowerMode();
                    game.spawnPopup(this.pos.x, this.pos.y, "POWER UP!", "#FFF");
                } else {
                    if (Math.random() < 0.3) game.spawnPopup(this.pos.x, this.pos.y, "10", "#FFB8AE");
                }
            }
        }

        game.actors.ghosts.forEach(g => {
            if (g.dead) return;
            if (Vec2.dist(this.pos, g.pos) < this.radius + g.radius) {
                if (game.powerMode) {
                    g.dead = true;
                    this.combo++;
                    const score = 200 * this.combo;
                    game.spawnPopup(this.pos.x, this.pos.y - 20, `${score}`, "#0FF");
                    game.spawnParticles(g.pos.x, g.pos.y, g.color);
                    setTimeout(() => {
                        g.dead = false;
                        g.pos = { x: Math.random() * game.width, y: Math.random() * game.height };
                    }, 5000);
                } else {
                    game.spawnPopup(this.pos.x, this.pos.y, "OUCH!", "#F00");
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
        ctx.fillStyle = COLORS.pacman;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, this.mouthOpen, Math.PI * 2 - this.mouthOpen);
        ctx.lineTo(0, 0);
        ctx.fill();
        ctx.restore();
    }
}

class Ghost {
    constructor(x, y, color) {
        this.pos = { x, y };
        this.vel = { x: 0, y: 0 };
        this.color = color;
        this.radius = 20;
        this.dead = false;
        this.speedMod = Math.random() * 20;
    }

    update(dt, game) {
        if (this.dead) return;
        let steering = { x: 0, y: 0 };

        if (game.powerMode) {
            let flee = Vec2.sub(this.pos, game.actors.pacman.pos);
            flee = Vec2.normalize(flee);
            flee = Vec2.mult(flee, CONFIG.ghostFleeSpeed);
            steering = Vec2.add(steering, flee);
        } else {
            let seek = Vec2.sub(game.actors.pacman.pos, this.pos);
            seek = Vec2.normalize(seek);
            seek = Vec2.mult(seek, CONFIG.ghostSpeed + this.speedMod);
            steering = Vec2.add(steering, seek);
        }

        game.actors.ghosts.forEach(other => {
            if (other !== this && !other.dead) {
                const d = Vec2.dist(this.pos, other.pos);
                if (d < 50) {
                    let push = Vec2.sub(this.pos, other.pos);
                    push = Vec2.normalize(push);
                    push = Vec2.mult(push, 50);
                    steering = Vec2.add(steering, push);
                }
            }
        });

        const margin = 50;
        if (this.pos.x < margin) steering.x += 100;
        if (this.pos.x > game.width - margin) steering.x -= 100;
        if (this.pos.y < margin) steering.y += 100;
        if (this.pos.y > game.height - margin) steering.y -= 100;

        steering = Vec2.limit(steering, 5);
        this.vel = Vec2.add(this.vel, steering);
        this.vel = Vec2.limit(this.vel, game.powerMode ? CONFIG.ghostFleeSpeed : CONFIG.ghostSpeed + this.speedMod);

        this.pos = Vec2.add(this.pos, Vec2.mult(this.vel, dt));
    }

    draw(ctx, isFrightened, timer) {
        if (this.dead) return;
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        let drawColor = this.color;
        if (isFrightened) {
            if (timer < 2 && Math.floor(Date.now() / 200) % 2 === 0) {
                drawColor = COLORS.frightenedFlash;
            } else {
                drawColor = COLORS.frightened;
            }
        }
        ctx.fillStyle = drawColor;
        ctx.beginPath();
        ctx.arc(0, -2, this.radius, Math.PI, 0);
        const wiggle = Math.sin(Date.now() / 100) * 3;
        ctx.lineTo(this.radius, this.radius - 5 + wiggle);
        ctx.lineTo(this.radius / 2, this.radius + wiggle);
        ctx.lineTo(-this.radius / 2, this.radius - 5 - wiggle);
        ctx.lineTo(-this.radius, this.radius + wiggle);
        ctx.lineTo(-this.radius, -2);
        ctx.fill();

        ctx.fillStyle = '#FFF';
        ctx.beginPath(); ctx.arc(-7, -5, 5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(7, -5, 5, 0, Math.PI * 2); ctx.fill();

        if (isFrightened) {
            ctx.strokeStyle = '#FFB8AE';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-10, 10); ctx.lineTo(-5, 5); ctx.lineTo(0, 10); ctx.lineTo(5, 5); ctx.lineTo(10, 10);
            ctx.stroke();
        } else {
            ctx.fillStyle = '#0000FF';
            const lookX = this.vel.x > 0 ? 2 : -2;
            const lookY = this.vel.y > 0 ? 2 : -2;
            ctx.beginPath(); ctx.arc(-7 + lookX, -5 + lookY, 2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(7 + lookX, -5 + lookY, 2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }
}

class Dot {
    constructor(x, y, isPower) {
        this.pos = { x, y };
        this.isPower = isPower;
        this.radius = isPower ? 8 : 4;
    }
    draw(ctx) {
        ctx.beginPath();
        ctx.fillStyle = this.isPower ? COLORS.powerDot : COLORS.dot;
        if (this.isPower && Math.floor(Date.now() / 200) % 2 === 0) {
            ctx.globalAlpha = 0.5;
        }
        ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

new Director();