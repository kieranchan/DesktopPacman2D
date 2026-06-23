// Minimal 2D vector helpers. Operations return new objects (no in-place mutation).
export const Vec2 = {
    add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y }),
    sub: (a, b) => ({ x: a.x - b.x, y: a.y - b.y }),
    mult: (v, n) => ({ x: v.x * n, y: v.y * n }),
    mag: (v) => Math.sqrt(v.x * v.x + v.y * v.y),
    normalize: (v) => {
        const m = Vec2.mag(v);
        return m === 0 ? { x: 0, y: 0 } : { x: v.x / m, y: v.y / m };
    },
    dist: (a, b) => Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2),
    limit: (v, max) => {
        const m = Vec2.mag(v);
        return m > max ? Vec2.mult(v, max / m) : v;
    }
};
