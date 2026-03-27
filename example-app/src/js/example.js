import { UsbPrinter } from 'capacitor-usb-printer';

window.testEcho = () => {
    const inputValue = document.getElementById("echoInput").value;
    UsbPrinter.echo({ value: inputValue })
}

window.connectedDevices = new Map();

window.connectUsb = async () => {
    const sel = document.getElementById('deviceSelect');
    if (!sel) { log('No device selector'); return; }
    const selected = Array.from(sel.selectedOptions).map(o => parseInt(o.value, 10)).filter(Boolean);
    if (selected.length === 0) { log('No device(s) selected'); return; }
    for (const deviceId of selected) {
        log('Attempting to connect to device ' + deviceId + '...');
        try {
            const res = await UsbPrinter.connectToDevice({ deviceId });
            log('Connected: ' + JSON.stringify(res));
            if (res && res.deviceId) window.connectedDevices.set(res.deviceId, true);
            populateConnectedList();
        } catch (e) {
            log('Connect error for ' + deviceId + ': ' + e);
        }
    }
};

window.listUsb = async () => {
    try {
        const res = await UsbPrinter.listDevices();
        log('Devices: ' + JSON.stringify(res));
        populateDeviceSelect(res.devices || []);
    } catch (e) {
        log('List error: ' + e);
    }
};

window.sendUsb = async () => {
    const msg = document.getElementById('sendInput').value;
    const sel = document.getElementById('deviceSelect');
    const selected = sel ? Array.from(sel.selectedOptions).map(o => parseInt(o.value, 10)).filter(Boolean) : [];
    if (selected.length === 0) { log('No device selected'); return; }
    for (const deviceId of selected) {
        try {
            const res = await UsbPrinter.sendMessage({ deviceId, message: msg });
            log(`Send result (${deviceId}): ` + JSON.stringify(res));
        } catch (e) {
            log(`Send error (${deviceId}): ` + e);
        }
    }
};

window.disconnectUsb = async () => {
    const sel = document.getElementById('deviceSelect');
    const selected = sel ? Array.from(sel.selectedOptions).map(o => parseInt(o.value, 10)).filter(Boolean) : [];
    if (selected.length === 0) { log('No device selected'); return; }
    for (const deviceId of selected) {
        try {
            const res = await UsbPrinter.disconnect({ deviceId });
            log('Disconnected (' + deviceId + '): ' + JSON.stringify(res));
            window.connectedDevices.delete(deviceId);
            populateConnectedList();
        } catch (e) {
            log('Disconnect error (' + deviceId + '): ' + e);
        }
    }
};

window.checkConnected = async () => {
    const sel = document.getElementById('deviceSelect');
    const selected = sel ? Array.from(sel.selectedOptions).map(o => parseInt(o.value, 10)).filter(Boolean) : [];
    if (selected.length === 0) { log('No device selected'); return; }
    for (const deviceId of selected) {
        try {
            const res = await UsbPrinter.isConnected({ deviceId });
            log('isConnected (' + deviceId + '): ' + JSON.stringify(res));
            if (res && res.connected) window.connectedDevices.set(deviceId, true); else window.connectedDevices.delete(deviceId);
            populateConnectedList();
        } catch (e) {
            log('isConnected error (' + deviceId + '): ' + e);
        }
    }
};

window.showConnected = () => {
    populateConnectedList();
};

// Named device slots
window.deviceA = null;
window.deviceB = null;

window.assignA = () => {
    const sel = document.getElementById('deviceSelect');
    const selected = sel ? Array.from(sel.selectedOptions).map(o => parseInt(o.value, 10)).filter(Boolean) : [];
    if (selected.length === 0) { log('No device selected to assign to A'); return; }
    window.deviceA = selected[0];
    document.getElementById('slotA').textContent = `A: ${window.deviceA}`;
    log('Assigned device ' + window.deviceA + ' to slot A');
};

window.assignB = () => {
    const sel = document.getElementById('deviceSelect');
    const selected = sel ? Array.from(sel.selectedOptions).map(o => parseInt(o.value, 10)).filter(Boolean) : [];
    if (selected.length === 0) { log('No device selected to assign to B'); return; }
    window.deviceB = selected[0];
    document.getElementById('slotB').textContent = `B: ${window.deviceB}`;
    log('Assigned device ' + window.deviceB + ' to slot B');
};

window.sendToA = async () => {
    if (!window.deviceA) { log('No device assigned to A'); return; }
    const msg = document.getElementById('sendInput').value;
    try {
        const res = await UsbPrinter.sendMessage({ deviceId: window.deviceA, message: msg });
        log('SendToA result: ' + JSON.stringify(res));
    } catch (e) {
        log('SendToA error: ' + e);
    }
};

window.sendToB = async () => {
    if (!window.deviceB) { log('No device assigned to B'); return; }
    const msg = document.getElementById('sendInput').value;
    try {
        const res = await UsbPrinter.sendMessage({ deviceId: window.deviceB, message: msg });
        log('SendToB result: ' + JSON.stringify(res));
    } catch (e) {
        log('SendToB error: ' + e);
    }
};

function populateConnectedList() {
    const el = document.getElementById('connectedList');
    if (!el) return;
    el.innerHTML = '';
    if (!window.connectedDevices || window.connectedDevices.size === 0) {
        el.textContent = 'No connected devices';
        return;
    }
    const ul = document.createElement('ul');
    for (const id of window.connectedDevices.keys()) {
        const li = document.createElement('li');
        let label = `deviceId: ${id}`;
        if (window.deviceA === id) label += ' (A)';
        if (window.deviceB === id) label += ' (B)';
        li.textContent = label;
        ul.appendChild(li);
    }
    el.appendChild(ul);
}

// Bulk connect to every device listed in the select
window.connectAll = async () => {
    const sel = document.getElementById('deviceSelect');
    if (!sel) { log('No device selector'); return; }
    const all = Array.from(sel.options).map(o => parseInt(o.value, 10)).filter(Boolean);
    if (all.length === 0) { log('No devices available to connect'); return; }
    for (const deviceId of all) {
        try {
            const res = await UsbPrinter.connectToDevice({ deviceId });
            log('ConnectAll: connected ' + JSON.stringify(res));
            if (res && res.deviceId) window.connectedDevices.set(res.deviceId, true);
        } catch (e) {
            log('ConnectAll error ' + deviceId + ': ' + e);
        }
    }
    populateConnectedList();
};

// Bulk disconnect all currently listed devices
window.disconnectAll = async () => {
    const sel = document.getElementById('deviceSelect');
    const all = sel ? Array.from(sel.options).map(o => parseInt(o.value, 10)).filter(Boolean) : [];
    if (all.length === 0) { log('No devices available to disconnect'); return; }
    for (const deviceId of all) {
        try {
            const res = await UsbPrinter.disconnect({ deviceId });
            log('DisconnectAll: ' + deviceId + ' -> ' + JSON.stringify(res));
            window.connectedDevices.delete(deviceId);
        } catch (e) {
            log('DisconnectAll error ' + deviceId + ': ' + e);
        }
    }
    populateConnectedList();
};

function populateDeviceSelect(devices) {
    const sel = document.getElementById('deviceSelect');
    if (!sel) return;
    // clear existing options
    sel.innerHTML = '';
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = '-- select device --';
    sel.appendChild(empty);
    devices.forEach(d => {
        const opt = document.createElement('option');
        opt.value = String(d.deviceId);
        opt.textContent = `${d.productName || d.deviceName || 'USB Device'} (id:${d.deviceId} vendor:${d.vendorId} product:${d.productId})`;
        sel.appendChild(opt);
    });
}

function log(msg) {
    const el = document.getElementById('log');
    if (el) {
        el.textContent = el.textContent + '\n' + msg;
    } else {
        console.log(msg);
    }
}

// listen for incoming USB data
UsbPrinter.addListener('usbData', (ev) => {
    log('usbData -> ' + JSON.stringify(ev));
});
