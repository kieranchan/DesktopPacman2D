const { contextBridge, ipcRenderer } = require('electron');

const channels = {
    config: 'runtime:config',
    reset: 'runtime:reset',
    paused: 'runtime:paused',
    crt: 'runtime:crt'
};

function listenerFor(channel) {
    return (handler) => {
        if (typeof handler !== 'function') return () => {};
        const wrapped = (_event, payload) => handler(payload);
        ipcRenderer.on(channel, wrapped);
        return () => ipcRenderer.removeListener(channel, wrapped);
    };
}

contextBridge.exposeInMainWorld('petAPI', {
    onConfig: listenerFor(channels.config),
    onReset: listenerFor(channels.reset),
    onPaused: listenerFor(channels.paused),
    onCrt: listenerFor(channels.crt),
    requestInitialConfig: () => ipcRenderer.invoke('runtime:get-config')
});
