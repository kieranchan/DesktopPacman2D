import { CONFIG, PALETTE } from './constants.js';
import { Vec2 } from './vec2.js';

// Steering-behavior pac-man: seeks nearest dot (power-pellets weighted), flees
// nearby ghosts when not powered up, deflects from screen edges.
export class ClassicPacman {
    constructor(x, y) {
        this.pos = { x, y };
        this.vel = { x: 0, y: 0 };
        this.radius = 18;
        this.angle = 0;
        this.mouthOpen = 0;
        this.powerTimer = 0;
    }

    update(dt, game) {
        const speed = CONFIG.pacSpeed * game.config.speedMultiplier;
        let steering = { x: 0, y: 0 };
        let target = null;
        let minDist = Infinity;

        // Prefer power pellets via a big distance penalty.
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

        // Flee nearby ghosts when not powered.
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

        // Edge repulsion.
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
        // Eat dots.
        for (let i = game.actors.dots.length - 1; i >= 0; i--) {
            const dot = game.actors.dots[i];
            if (Vec2.dist(this.pos, dot.pos) < this.radius) {
                game.actors.dots.splice(i, 1);
                if (dot.isPower) {
                    this.powerTimer = 6.0;
                    game.logSystem("SYS.ALERT", "OVERDRIVE ENABLED (6s)");
                }
            }
        }
        // Touch ghosts.
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

        ctx.fillStyle = PALETTE.pacman;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, this.mouthOpen, Math.PI * 2 - this.mouthOpen);
        ctx.lineTo(0, 0);
        ctx.fill();

        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
    }
}
