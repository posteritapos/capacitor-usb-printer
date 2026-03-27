# capacitor-usb-printer

Usb printer plugin

## Install

Install from npm:

```bash
npm install capacitor-usb-printer
```

Install directly from the GitHub repository:

```bash
# npm (Git URL)
npm install git+https://github.com/posteritapos/capacitor-usb-printer.git

# yarn
yarn add https://github.com/posteritapos/capacitor-usb-printer.git
```

Sync native files

```bash
npx cap sync
```
## Usage in a Capacitor 8 app

1. Install and sync the plugin:

```bash
npm install capacitor-usb-printer
npx cap sync
```

2. Android setup

- The plugin declares the USB host feature. Ensure your app has a valid Android SDK path when building locally (`example-app/android/local.properties` may need `sdk.dir=...`).
- The plugin will request USB permission at runtime; no extra manifest entries are required, but if you want to filter specific devices you can add device filters in your app manifest.


3. Example usage (TypeScript)

```ts
import { UsbPrinter } from 'capacitor-usb-printer';

// enumerate attached devices and let the user pick one
const { devices } = await UsbPrinter.listDevices();
console.log('attached devices', devices);

// connect to a chosen device by deviceId
const pick = devices[0];
const { deviceId } = await UsbPrinter.connectToDevice({ deviceId: pick.deviceId });
console.log('connected to', deviceId);

// send plain text to a specific device
await UsbPrinter.sendMessage({ deviceId, message: 'Hello Printer\n' });

// send binary ESC/POS payloads (convert a Uint8Array to base64)
function uint8ToBase64(u8: Uint8Array) {
	let binary = '';
	for (let i = 0; i < u8.length; i++) binary += String.fromCharCode(u8[i]);
	return btoa(binary);
}

const escpos = new Uint8Array([0x1b, 0x40]); // init
await UsbPrinter.sendMessage({ deviceId, data: uint8ToBase64(escpos) });

// listen for incoming device data (events include deviceId)
UsbPrinter.addListener('usbData', (ev) => {
	console.log('usbData', ev); // { data: string, deviceId: number }
});

// per-device connection check and disconnect
const status = await UsbPrinter.isConnected({ deviceId });
if (status.connected) await UsbPrinter.disconnect({ deviceId });
```

4. Build & run

```bash
# sync native projects and open Android Studio
npx cap sync
npx cap open android

# or build from CLI (example-app)
cd example-app/android && ./gradlew assembleDebug
```

Notes
- This plugin currently supports Android USB host APIs and Web (stub/compatibility).
- Use `listDevices()` to enumerate attached USB devices and present a picker to users. If a device doesn't work, capture its metadata and file an issue so endpoint/interface handling can be improved.
- For ESC/POS, prefer sending base64 binary payloads to avoid encoding issues.

```

## API

<docgen-index>
</docgen-index>

This plugin provides a small set of Android-only USB helpers for listing devices, requesting permission, opening a connection, sending binary (ESC/POS) data and receiving incoming data events.

<docgen-index>

* [`echo(...)`](#echo)
* [`listDevices()`](#listdevices)
* [`connectToDevice(...)`](#connecttodevice)
* [`checkForDevices(...)`](#checkfordevices)
* [`sendMessage(...)`](#sendmessage)
* [`controlTransfer(...)`](#controltransfer)
* [`disconnect(...)`](#disconnect)
* [`isConnected(...)`](#isconnected)

</docgen-index>
</docgen-index>

<docgen-api>
<!--Update the source file JSDoc comments and rerun docgen to update the docs below-->

### echo(...)

```typescript
echo(options: { value: string; }) => Promise<{ value: string; }>
```

| Param         | Type                            |
| ------------- | ------------------------------- |
| **`options`** | <code>{ value: string; }</code> |

**Returns:** <code>Promise&lt;{ value: string; }&gt;</code>

--------------------

### listDevices()

```typescript
listDevices() => Promise<{ devices: Array<any> }>
```

Returns an array of attached USB devices with metadata: `deviceId`, `vendorId`, `productId`, `productName`, `manufacturerName`, `deviceName`, and `interfaceCount`. Use this to present a device picker to users.

### checkForDevices(...)

```typescript
checkForDevices(options?: { vendorId?: number; productId?: number }) => Promise<{ code?: string; message: string }>
```

Searches for a matching USB device (defaults to vendorId 1659 / productId 9123). If found, requests permission if needed and opens the connection.

Note: `checkForDevices` is a convenience helper that searches by vendor/product and will connect to the first matching device. For multi-device workflows prefer `connectToDevice(...)` below which lets you target a specific `deviceId`.

### connectToDevice(...)

```typescript
connectToDevice(options: { deviceId?: number; vendorId?: number; productId?: number }) => Promise<{ code?: string; message: string; deviceId?: number }>
```

Attempt to open and register a connection to a device. Provide either `deviceId` (from `listDevices()`), or `vendorId`/`productId`. If permission is required the plugin will request it and resolve once granted. On success the call returns the `deviceId` assigned to the opened connection.

### sendMessage(...)

```typescript
sendMessage(options: { deviceId?: number; message?: string; data?: string /* base64 */ }) => Promise<{ code?: string; message: string }>
```

Send data to a connected device. When multiple devices are connected provide `deviceId` to target the intended device. If only one device is open `deviceId` is optional for convenience.

You can provide a UTF-8 `message` string or a base64 `data` payload for binary ESC/POS commands. The plugin prefers `message` when present; otherwise it will decode the `data` base64 payload.

Example (ESC/POS binary):

```ts
function uint8ToBase64(u8: Uint8Array) {
	let binary = '';
	const len = u8.byteLength;
	for (let i = 0; i < len; i++) binary += String.fromCharCode(u8[i]);
	return btoa(binary);
}

const escpos = new Uint8Array([0x1b, 0x40]); // initialize printer
await UsbPrinter.sendMessage({ deviceId, data: uint8ToBase64(escpos) });
```

### controlTransfer(...)

```typescript
controlTransfer(options: { deviceId?: number; requestType: number; request: number; value: number; index: number; data?: string /* base64 */; timeout?: number }) => Promise<{ code?: string; message?: string; response?: string /* base64 */ }>
```

Perform a USB control transfer on a specific connected device. Provide `deviceId` when multiple devices are open; otherwise `deviceId` is optional when a single connection exists.

### disconnect(...)

```typescript
disconnect(options?: { deviceId?: number }) => Promise<{ code?: string; message?: string }>
```

Close a connection. Provide `deviceId` to close a specific device; if only one connection exists `deviceId` may be omitted.

### isConnected(...)

```typescript
isConnected(options?: { deviceId?: number }) => Promise<{ connected: boolean; count?: number; deviceId?: number }>
```

Query connection status. When `deviceId` is provided returns the state for that device; otherwise returns whether any devices are connected and the total `count`.

### Events

- `usbData` — emitted when a device sends data. Subscribe with `UsbPrinter.addListener('usbData', (event) => ...)`. Event payload: `{ data: string; deviceId: number }` where `data` is UTF-8 decoded. For raw bytes the plugin currently emits UTF-8 text; to receive binary payloads you can request the device and read via control transfers or use base64-encoded responses where appropriate.

Notes:
- This plugin implements Android USB host support only. The web implementation stubs will reject binary device calls.
- For ESC/POS send binary payloads using base64 (see helper above) to avoid encoding issues.
- The plugin attempts to detect IN/OUT endpoints automatically but some devices require explicit interface/endpoint selection. If you encounter a device that doesn't work, open an issue with the device metadata from `listDevices()`.
- Add `android.hardware.usb.host` usage to app manifest is declared by the plugin.

</docgen-api>
</docgen-api>
