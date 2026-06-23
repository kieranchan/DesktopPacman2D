// Tunable simulation constants. Runtime overrides come from window.petAPI.
export const CONFIG = Object.freeze({
    pacSpeed: 180,
    ghostSpeed: 140,
    fleeSpeed: 100,
    dotCount: 30,
    crtStrength: 0.2
});

// High-contrast retro-terminal palette.
export const PALETTE = Object.freeze({
    pacman: '#FFFF00',
    ghosts: ['#FF0000', '#FF69B4', '#00FFFF', '#FF8C00'],
    frightened: '#0000FF',
    frightenedFlash: '#FFFFFF',
    dot: '#00FF00',
    power: '#FFB000',
    text: '#00FF00'
});
