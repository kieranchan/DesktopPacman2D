import { CONFIG, PALETTE } from './constants.js';
import { ClassicPacman } from './pacman.js';
import { ClassicGhost } from './ghost.js';

// Game loop owner: actors, timing, rendering. Subscribes to the preload
// bridge (window.petAPI) for runtime config changes and reset commands.
export class Director {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;
        document.body.appendChild(this.canvas);

        this.width = window.innerWidth;
        this.height = window.innerHeight;

        this.actors = { pacman: null, ghosts: [], dots: [], logs: [] };
        this.gameTime = 0;

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
        if (next.dotCount < this.actors.dots.length) {
            this.actors.dots.length = next.dotCount;
        }
        const wasPaused = this.config.paused;
        this.config = next;
        if (wasPaused && !next.paused) {
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

        for (let i = 0; i < this.config.dotCount; i++) this.spawnDot();
    }

    spawnDot() {
        const pad = 50;
        const x = Math.random() * (this.width - pad * 2) + pad;
        const y = Math.random() * (this.height - pad * 2) + pad;
        this.actors.dots.push({ pos: { x, y }, isPower: Math.random() < 0.05, size: 6 });
    }

    logSystem(type, msg) {
        this.actors.logs.push({
            text: `[${type}] ${msg}`,
            y: this.height - 50,
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

        this.drawWorld();

        if (this.config.crtEnabled && this.config.crtStrength > 0) {
            this.drawCRTOverlay();
        }

        requestAnimationFrame(t => this.loop(t));
    }

    updateLogs(dt) {
        for (let i = this.actors.logs.length - 1; i >= 0; i--) {
            const log = this.actors.logs[i];
            log.y -= 20 * dt;
            log.life -= dt;
            if (log.life <= 0) this.actors.logs.splice(i, 1);
        }
    }

    drawWorld() {
        this.actors.dots.forEach(d => {
            this.ctx.fillStyle = d.isPower ? PALETTE.power : PALETTE.dot;
            const s = d.isPower ? d.size * 2 : d.size;
            this.ctx.fillRect(d.pos.x - s / 2, d.pos.y - s / 2, s, s);

            if (d.isPower && Math.floor(this.gameTime * 10) % 2 === 0) {
                this.ctx.strokeStyle = PALETTE.power;
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(d.pos.x - s, d.pos.y - s, s * 2, s * 2);
            }
        });

        this.actors.pacman.draw(this.ctx);
        this.actors.ghosts.forEach(g => g.draw(this.ctx, this.actors.pacman));

        this.ctx.font = "bold 16px 'Courier New', Consolas, monospace";
        this.ctx.textAlign = "left";
        this.actors.logs.forEach((log, i) => {
            const cursor = Math.floor(this.gameTime * 2) % 2 === 0 ? '_' : ' ';
            this.ctx.fillStyle = PALETTE.text;
            this.ctx.globalAlpha = Math.min(log.life, 1) * 0.8;
            this.ctx.fillText(
                `> ${log.text}${i === this.actors.logs.length - 1 ? cursor : ''}`,
                50, log.y
            );
        });
        this.ctx.globalAlpha = 1;
    }

    drawCRTOverlay() {
        this.ctx.save();
        this.ctx.fillStyle = `rgba(0, 0, 0, ${this.config.crtStrength})`;
        for (let y = 0; y < this.height; y += 3) {
            this.ctx.fillRect(0, y, this.width, 1);
        }
        if (Math.random() > 0.95) {
            this.ctx.fillStyle = `rgba(0, 255, 0, 0.02)`;
            this.ctx.fillRect(0, 0, this.width, this.height);
        }
        this.ctx.restore();
    }
}
