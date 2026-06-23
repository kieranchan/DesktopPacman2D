const fs = require('fs');
const path = require('path');
const log = require('electron-log');

const DEFAULTS = Object.freeze({
    paused: false,
    crtEnabled: true,
    crtStrength: 0.2,       // 0 (off) | 0.1 (light) | 0.2 (standard) | 0.35 (heavy)
    speedMultiplier: 1.0,   // 0.5 | 1.0 | 1.5 | 2.0
    dotCount: 30,           // 15 | 30 | 60
    autoStart: false
});

let cache = null;
let configPath = null;
let saveTimer = null;

function init(userDataDir) {
    configPath = path.join(userDataDir, 'pacman-config.json');
    cache = { ...DEFAULTS };
    try {
        if (fs.existsSync(configPath)) {
            const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            for (const key of Object.keys(DEFAULTS)) {
                if (key in parsed && typeof parsed[key] === typeof DEFAULTS[key]) {
                    cache[key] = parsed[key];
                }
            }
        }
    } catch (e) {
        log.error('Failed to load config, falling back to defaults:', e.message);
    }
    return get();
}

function get() {
    return { ...cache };
}

function update(partial) {
    cache = { ...cache, ...partial };
    scheduleSave();
    return get();
}

function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        saveTimer = null;
        try {
            fs.writeFileSync(configPath, JSON.stringify(cache, null, 2), 'utf8');
        } catch (e) {
            log.error('Failed to save config:', e.message);
        }
    }, 250);
}

function flush() {
    if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
        try {
            fs.writeFileSync(configPath, JSON.stringify(cache, null, 2), 'utf8');
        } catch (e) {
            log.error('Failed to flush config:', e.message);
        }
    }
}

module.exports = { DEFAULTS, init, get, update, flush };
