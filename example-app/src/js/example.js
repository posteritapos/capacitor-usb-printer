import { UsbPrinter } from 'capacitor-usb-printer';

// Helper for Base64 binary
function uint8ToBase64(u8) {
  let binary = '';
  const len = u8.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(u8[i]);
  }
  return btoa(binary);
}

// ESC/POS Commands
const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;

window.testEcho = async () => {
    const inputValue = document.getElementById("echoInput").value;
    log(`Testing Echo: ${inputValue}...`, 'info');
    try {
        const res = await UsbPrinter.echo({ value: inputValue });
        log(`Echo Result: ${JSON.stringify(res)}`, 'success');
    } catch (e) {
        log(`Echo Error: ${e}`, 'error');
    }
}

window.connectedDevices = new Map();

window.listUsb = async () => {
    log('Scanning for USB devices...', 'info');
    try {
        const res = await UsbPrinter.listDevices();
        log(`Found ${res.devices?.length || 0} device(s)`, 'success');
        populateDeviceSelect(res.devices || []);
    } catch (e) {
        log(`Discovery Error: ${e}`, 'error');
    }
};

window.connectUsb = async () => {
    const sel = document.getElementById('deviceSelect');
    if (!sel) return;
    const selected = Array.from(sel.selectedOptions).map(o => parseInt(o.value, 10)).filter(Boolean);
    if (selected.length === 0) { log('Please select at least one device', 'warn'); return; }
    
    for (const deviceId of selected) {
        log(`Opening connection to device ${deviceId}...`, 'info');
        try {
            const res = await UsbPrinter.connectToDevice({ deviceId });
            log(`Success: ${JSON.stringify(res)}`, 'success');
            if (res && res.deviceId) window.connectedDevices.set(res.deviceId, true);
        } catch (e) {
            log(`Connection Failed (${deviceId}): ${e}`, 'error');
        }
    }
    populateConnectedList();
};

window.disconnectUsb = async () => {
    const sel = document.getElementById('deviceSelect');
    const selected = sel ? Array.from(sel.selectedOptions).map(o => parseInt(o.value, 10)).filter(Boolean) : [];
    if (selected.length === 0) { log('Nothing selected to disconnect', 'warn'); return; }

    for (const deviceId of selected) {
        try {
            const res = await UsbPrinter.disconnect({ deviceId });
            log(`Disconnected device ${deviceId}`, 'success');
            window.connectedDevices.delete(deviceId);
        } catch (e) {
            log(`Disconnect error (${deviceId}): ${e}`, 'error');
        }
    }
    populateConnectedList();
};

window.checkConnected = async () => {
    const sel = document.getElementById('deviceSelect');
    const selected = sel ? Array.from(sel.selectedOptions).map(o => parseInt(o.value, 10)).filter(Boolean) : [];
    if (selected.length === 0) { log('Select a device to check', 'warn'); return; }
    
    for (const deviceId of selected) {
        try {
            const res = await UsbPrinter.isConnected({ deviceId });
            log(`Status for ${deviceId}: ${res.connected ? 'CONNECTED' : 'OFFLINE'}`, res.connected ? 'success' : 'warn');
            if (res && res.connected) window.connectedDevices.set(deviceId, true); else window.connectedDevices.delete(deviceId);
        } catch (e) {
            log(`Status Check Error (${deviceId}): ${e}`, 'error');
        }
    }
    populateConnectedList();
};

window.sendUsb = async () => {
    const msg = document.getElementById('sendInput').value;
    const targets = getActiveTargets();
    if (targets.length === 0) { log('No active/selected targets', 'warn'); return; }
    
    for (const deviceId of targets) {
        try {
            await UsbPrinter.sendMessage({ deviceId, message: msg + '\n' });
            log(`Message sent to ${deviceId}`, 'success');
        } catch (e) {
            log(`Send Error (${deviceId}): ${e}`, 'error');
        }
    }
};

window.printTestReceipt = async () => {
    const targets = getActiveTargets();
    if (targets.length === 0) { log('No active targets to print to', 'warn'); return; }

    const commands = new Uint8Array([
        ESC, 0x40, // Initialize
        ESC, 0x61, 0x01, // Center align
        ...new TextEncoder().encode("CAPACITOR PRINTER\n"),
        ...new TextEncoder().encode("USB Host Test Receipt\n"),
        ...new TextEncoder().encode("----------------------------\n"),
        ESC, 0x61, 0x00, // Left align
        ...new TextEncoder().encode("Product 1       $10.00\n"),
        ...new TextEncoder().encode("Product 2       $05.50\n"),
        ...new TextEncoder().encode("\n"),
        ESC, 0x61, 0x01, // Center
        ...new TextEncoder().encode("Thank you for using Capacitor!\n"),
        LF, LF, LF, LF,
        GS, 0x56, 0x42, 0x00 // Partial cut
    ]);

    const dataB64 = uint8ToBase64(commands);
    
    for (const deviceId of targets) {
        try {
            log(`Sending binary receipt to ${deviceId}...`, 'info');
            await UsbPrinter.sendMessage({ deviceId, data: dataB64 });
            log(`Test receipt printed successfully on ${deviceId}`, 'success');
        } catch (e) {
            log(`Print Error (${deviceId}): ${e}`, 'error');
        }
    }
};

window.kickDrawer = async () => {
    const targets = getActiveTargets();
    // Pulse to drawer kick (standard 2-pin)
    const cmd = uint8ToBase64(new Uint8Array([0x1B, 0x70, 0x00, 0x19, 0xC8]));
    for (const deviceId of targets) {
        await UsbPrinter.sendMessage({ deviceId, data: cmd });
        log(`Cash drawer kick sent to ${deviceId}`, 'info');
    }
};

window.cutPaper = async () => {
    const targets = getActiveTargets();
    const cmd = uint8ToBase64(new Uint8Array([0x1D, 0x56, 0x41, 0x00])); // Feed & full cut
    for (const deviceId of targets) {
        await UsbPrinter.sendMessage({ deviceId, data: cmd });
        log(`Paper cut command sent to ${deviceId}`, 'info');
    }
};

function getActiveTargets() {
    const sel = document.getElementById('deviceSelect');
    const selected = sel ? Array.from(sel.selectedOptions).map(o => parseInt(o.value, 10)).filter(Boolean) : [];
    if (selected.length > 0) return selected;
    // Fallback to all connected if none selected
    if (window.connectedDevices.size > 0) {
        return Array.from(window.connectedDevices.keys());
    }
    return [];
}

// Slot assignment
window.deviceA = null;
window.deviceB = null;

window.assignA = () => {
    const sel = document.getElementById('deviceSelect');
    const selected = sel ? Array.from(sel.selectedOptions).map(o => parseInt(o.value, 10)).filter(Boolean) : [];
    if (selected.length === 0) { log('Selection needed for Slot A', 'warn'); return; }
    window.deviceA = selected[0];
    document.getElementById('slotA').textContent = `Slot A: ${window.deviceA}`;
    log(`Assigned device ${window.deviceA} to Slot A`, 'info');
};

window.assignB = () => {
    const sel = document.getElementById('deviceSelect');
    const selected = sel ? Array.from(sel.selectedOptions).map(o => parseInt(o.value, 10)).filter(Boolean) : [];
    if (selected.length === 0) { log('Selection needed for Slot B', 'warn'); return; }
    window.deviceB = selected[0];
    document.getElementById('slotB').textContent = `Slot B: ${window.deviceB}`;
    log(`Assigned device ${window.deviceB} to Slot B`, 'info');
};

window.sendToA = async () => {
    if (!window.deviceA) { log('Slot A empty', 'warn'); return; }
    await UsbPrinter.sendMessage({ deviceId: window.deviceA, message: "Testing Slot A...\n" });
    log('Sent test text to Slot A', 'info');
};

window.sendToB = async () => {
    if (!window.deviceB) { log('Slot B empty', 'warn'); return; }
    await UsbPrinter.sendMessage({ deviceId: window.deviceB, message: "Testing Slot B...\n" });
    log('Sent test text to Slot B', 'info');
};

function populateDeviceSelect(devices) {
    const sel = document.getElementById('deviceSelect');
    if (!sel) return;
    sel.innerHTML = '';
    devices.forEach(d => {
        const opt = document.createElement('option');
        opt.value = String(d.deviceId);
        opt.textContent = `${d.productName || d.deviceName || 'USB Device'} (id:${d.deviceId})`;
        sel.appendChild(opt);
    });
}

function populateConnectedList() {
    const el = document.getElementById('connectedList');
    if (!el) return;
    el.innerHTML = '';
    if (window.connectedDevices.size === 0) {
        el.innerHTML = '<div class="status-item" style="color: var(--text-muted);">No devices connected</div>';
        return;
    }
    for (const id of window.connectedDevices.keys()) {
        const div = document.createElement('div');
        div.className = 'status-item';
        div.innerHTML = `<span class="badge badge-success">Active</span> deviceId: ${id} ${window.deviceA === id ? '<span class="badge badge-primary">A</span>' : ''} ${window.deviceB === id ? '<span class="badge badge-primary">B</span>' : ''}`;
        el.appendChild(div);
    }
}

function log(msg, type = 'info') {
    const el = document.getElementById('log');
    if (!el) { console.log(msg); return; }
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    const now = new Date().toLocaleTimeString();
    entry.textContent = `[${now}] ${msg}`;
    el.appendChild(entry);
    el.scrollTop = el.scrollHeight;
}

// listen for incoming USB data
UsbPrinter.addListener('usbData', (ev) => {
    log(`Incoming Data [${ev.deviceId}]: ${ev.data}`, 'success');
});
