import { CONFIG, PALETTE } from './constants.js';
import { Vec2 } from './vec2.js';

// Steering-behavior ghost: seek pac-man, flee when pac-man is powered,
// separate from sibling ghosts to avoid clumping.
export class ClassicGhost {
    constructor(x, y, color) {
        this.pos = { x, y };
        this.vel = { x: 0, y: 0 };
        this.color = color;
        this.radius = 18;
        this.dead = false;
        this.timer = 0;
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

        // Separation from other ghosts.
        game.actors.ghosts.forEach(other => {
            if (other !== this && !other.dead && Vec2.dist(this.pos, other.pos) < 50) {
                steering = Vec2.add(
                    steering,
                    Vec2.mult(Vec2.normalize(Vec2.sub(this.pos, other.pos)), 80)
                );
            }
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
        game.logSystem("SYS.PURGE", `PID_${Math.floor(Math.random() * 9999)} ISOLATED`);
        setTimeout(() => {
            this.dead = false;
            this.pos = { x: Math.random() * game.width, y: Math.random() * game.height };
        }, 5000);
    }

    draw(ctx, target) {
        if (this.dead) return;
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);

        const isFrightened = target.powerTimer > 0;
        let drawColor = this.color;
        if (isFrightened) {
            drawColor = (target.powerTimer < 2 && Math.floor(Date.now() / 200) % 2 === 0)
                ? PALETTE.frightenedFlash
                : PALETTE.frightened;
        }

        ctx.fillStyle = drawColor;
        ctx.beginPath();
        ctx.arc(0, -4, this.radius, Math.PI, 0);
        const r = this.radius;
        const step = Math.floor(this.timer * 8) % 4;
        const wiggle = (step % 2 === 0) ? 4 : 0;
        ctx.lineTo(r, r - wiggle);
        ctx.lineTo(r * 0.5, r + wiggle);
        ctx.lineTo(0, r - wiggle);
        ctx.lineTo(-r * 0.5, r + wiggle);
        ctx.lineTo(-r, r - wiggle);
        ctx.lineTo(-r, -4);
        ctx.fill();

        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();

        if (isFrightened) {
            ctx.strokeStyle = PALETTE.dot;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-10, 8); ctx.lineTo(-5, 4); ctx.lineTo(0, 8);
            ctx.lineTo(5, 4); ctx.lineTo(10, 8);
            ctx.stroke();
        } else {
            ctx.fillStyle = '#FFF';
            ctx.beginPath(); ctx.arc(-7, -4, 6, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(7, -4, 6, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#000';
            const lx = this.vel.x > 0 ? 3 : -3;
            const ly = this.vel.y > 0 ? 3 : -3;
            ctx.fillRect(-9 + lx, -6 + ly, 4, 4);
            ctx.fillRect(5 + lx, -6 + ly, 4, 4);
        }

        ctx.restore();
    }
}
