package com.posterita.capacitor.plugin.printer.usb;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbManager;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.ArrayList;
import java.util.List;

public class UsbPrinter {

    private static final String TAG = "USB_SERIAL_COMM";
    private static final String ACTION_USB_PERMISSION = "org.posterita.cordova.USB_PERMISSION";

    private UsbManager usbManager;
    // map of deviceId -> Connection
    private final Map<Integer, Connection> connections = new ConcurrentHashMap<>();
    private Map<Integer, PluginCall> pendingCalls = new ConcurrentHashMap<>();
    private Context context;
    private Plugin plugin;
    // inner class to hold per-device connection state
    private static class Connection {
        UsbDevice device;
        UsbDeviceConnection conn;
        UsbEndpoint inEndpoint;
        UsbEndpoint outEndpoint;
        Thread readThread;
        volatile boolean readRunning = false;

        Connection(UsbDevice device) {
            this.device = device;
        }
    }

    private final BroadcastReceiver usbReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();
            if (ACTION_USB_PERMISSION.equals(action)) {
                synchronized (this) {
                    UsbDevice device = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
                    int deviceId = device != null ? device.getDeviceId() : -1;
                    if (intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)) {
                        if (device != null) {
                            // open and register connection
                            openUsbConnection(device);
                            PluginCall pc = pendingCalls.remove(deviceId);
                            if (pc != null) {
                                JSObject ret = new JSObject();
                                ret.put("code", "OK");
                                ret.put("message", "permission_granted_and_connected");
                                ret.put("deviceId", deviceId);
                                pc.resolve(ret);
                            }
                        }
                    } else {
                        Log.e(TAG, "Permission denied for USB device " + device);
                        PluginCall pc = pendingCalls.remove(deviceId);
                        if (pc != null) {
                            pc.reject("permission_denied");
                        }
                    }
                }
            }
        }
    };

    public void initialize(Context ctx) {
        if (this.context != null) {
            return; // already initialized
        }
        this.context = ctx;
        this.usbManager = (UsbManager) ctx.getSystemService(Context.USB_SERVICE);
        IntentFilter filter = new IntentFilter(ACTION_USB_PERMISSION);
        ctx.registerReceiver(usbReceiver, filter);
    }

    public void setPlugin(Plugin plugin) {
        this.plugin = plugin;
    }

    public void destroy() {
        try {
            if (context != null) {
                context.unregisterReceiver(usbReceiver);
            }
        } catch (Exception e) {
            Log.w(TAG, "Error unregistering receiver", e);
        }
        // close all connections
        for (Integer id : new ArrayList<>(connections.keySet())) {
            closeConnection(id);
        }
    }

    public void checkForDevices(PluginCall call) {
        // Deprecated simple helper: find device by vendor/product and connect
        if (usbManager == null) {
            call.reject("usb_manager_unavailable");
            return;
        }

        int vendorId = call.getInt("vendorId", 1659);
        int productId = call.getInt("productId", 9123);

        HashMap<String, UsbDevice> usbDevices = usbManager.getDeviceList();

        for (UsbDevice device : usbDevices.values()) {
            if (device.getVendorId() == vendorId && device.getProductId() == productId) {
                // delegate to connectToDevice behavior
                PluginCall pc = call;
                connectToDeviceInternal(device, pc);
                return;
            }
        }

        call.reject("no_matching_device_found");
    }

    /**
     * Connect to a device by deviceId or vendor/product via PluginCall.
     * Exposed method: connectToDevice
     */
    public void connectToDevice(PluginCall call) {
        initialize(context);
        if (usbManager == null) {
            call.reject("usb_manager_unavailable");
            return;
        }

        Integer deviceId = call.getInt("deviceId", -1);
        int vendorId = call.getInt("vendorId", -1);
        int productId = call.getInt("productId", -1);

        if (deviceId != -1) {
            // find device by id
            HashMap<String, UsbDevice> usbDevices = usbManager.getDeviceList();
            for (UsbDevice d : usbDevices.values()) {
                if (d.getDeviceId() == deviceId) {
                    connectToDeviceInternal(d, call);
                    return;
                }
            }
            call.reject("DEVICE_NOT_FOUND");
            return;
        }

        if (vendorId != -1 && productId != -1) {
            HashMap<String, UsbDevice> usbDevices = usbManager.getDeviceList();
            for (UsbDevice d : usbDevices.values()) {
                if (d.getVendorId() == vendorId && d.getProductId() == productId) {
                    connectToDeviceInternal(d, call);
                    return;
                }
            }
            call.reject("DEVICE_NOT_FOUND");
            return;
        }

        call.reject("INVALID_PARAMETERS");
    }

    private void connectToDeviceInternal(UsbDevice device, PluginCall call) {
        int id = device.getDeviceId();
        // already connected?
        if (connections.containsKey(id)) {
            JSObject ret = new JSObject();
            ret.put("code", "OK");
            ret.put("message", "already_connected");
            ret.put("deviceId", id);
            call.resolve(ret);
            return;
        }

        if (usbManager.hasPermission(device)) {
            // open immediately
            int created = openUsbConnection(device);
            if (created != -1) {
                JSObject ret = new JSObject();
                ret.put("code", "OK");
                ret.put("message", "connected");
                ret.put("deviceId", created);
                call.resolve(ret);
            } else {
                call.reject("ERROR_CONNECT");
            }
        } else {
            // request permission and save call
            pendingCalls.put(id, call);
            requestPermission(device);
        }
    }

    public void listDevices(PluginCall call) {
        if (usbManager == null) {
            call.reject("usb_manager_unavailable");
            return;
        }

        HashMap<String, UsbDevice> usbDevices = usbManager.getDeviceList();
        JSArray arr = new JSArray();
        for (UsbDevice device : usbDevices.values()) {
            JSObject d = new JSObject();
            d.put("deviceId", device.getDeviceId());
            d.put("vendorId", device.getVendorId());
            d.put("productId", device.getProductId());
            d.put("productName", device.getProductName());
            d.put("manufacturerName", device.getManufacturerName());
            d.put("deviceName", device.getDeviceName());
            d.put("interfaceCount", device.getInterfaceCount());
            arr.put(d);
        }

        JSObject ret = new JSObject();
        ret.put("devices", arr);
        call.resolve(ret);
    }

    private void requestPermission(UsbDevice device) {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent permissionIntent = PendingIntent.getBroadcast(context, 0, new Intent(ACTION_USB_PERMISSION), flags);
        usbManager.requestPermission(device, permissionIntent);
    }

    /**
     * Open a connection and register it in the connections map. Returns deviceId on success or -1.
     */
    private int openUsbConnection(UsbDevice device) {
        try {
            UsbInterface usbInterface = device.getInterface(0);
            UsbDeviceConnection conn = usbManager.openDevice(device);
            if (conn == null) {
                Log.e(TAG, "Failed to open USB connection");
                return -1;
            }

            if (!conn.claimInterface(usbInterface, true)) {
                conn.close();
                Log.e(TAG, "Failed to claim USB interface");
                return -1;
            }

            Connection c = new Connection(device);
            c.conn = conn;
            c.inEndpoint = null;
            c.outEndpoint = null;
            for (int i = 0; i < usbInterface.getEndpointCount(); i++) {
                UsbEndpoint ep = usbInterface.getEndpoint(i);
                if (ep.getDirection() == UsbConstants.USB_DIR_IN) {
                    c.inEndpoint = ep;
                } else if (ep.getDirection() == UsbConstants.USB_DIR_OUT) {
                    c.outEndpoint = ep;
                }
            }

            if (c.outEndpoint == null) {
                c.outEndpoint = usbInterface.getEndpointCount() > 1 ? usbInterface.getEndpoint(1) : usbInterface.getEndpoint(0);
            }

            int id = device.getDeviceId();
            connections.put(id, c);
            startReadLoopFor(id, c);
            Log.d(TAG, "USB connection opened successfully for deviceId=" + id);
            return id;
        } catch (Exception e) {
            Log.e(TAG, "Error opening USB connection", e);
            return -1;
        }
    }

    private void startReadLoopFor(int deviceId, Connection c) {
        if (c == null || c.conn == null || c.inEndpoint == null) return;
        if (c.readRunning) return;
        c.readRunning = true;
        c.readThread = new Thread(() -> {
            byte[] buffer = new byte[4096];
            while (c.readRunning && c.conn != null) {
                try {
                    int len = c.conn.bulkTransfer(c.inEndpoint, buffer, buffer.length, 2000);
                    if (len > 0) {
                        byte[] out = new byte[len];
                        System.arraycopy(buffer, 0, out, 0, len);
                        String data = new String(out);
                        if (plugin instanceof UsbPrinterPlugin) {
                            JSObject event = new JSObject();
                            event.put("data", data);
                            event.put("deviceId", deviceId);
                            ((UsbPrinterPlugin) plugin).notifyUsbData(event);
                        }
                    }
                } catch (Exception e) {
                    Log.w(TAG, "Error in read loop for device " + deviceId, e);
                    break;
                }
            }
            c.readRunning = false;
        });
        c.readThread.start();
    }

    private void stopReadLoop() {
        // not used in multi-instance; closeConnection handles per-connection cleanup
    }

    private void closeConnection(int deviceId) {
        Connection c = connections.remove(deviceId);
        if (c == null) return;
        try {
            c.readRunning = false;
            if (c.readThread != null) {
                try { c.readThread.join(200); } catch (InterruptedException ignored) {}
            }
            if (c.conn != null) {
                try { c.conn.releaseInterface(c.device.getInterface(0)); } catch (Exception ignored) {}
                try { c.conn.close(); } catch (Exception ignored) {}
            }
        } catch (Exception e) {
            Log.w(TAG, "Error closing connection " + deviceId, e);
        }
    }

    public void sendMessage(PluginCall call, String message) {
        int deviceId = call.getInt("deviceId", -1);
        Connection c = null;
        if (deviceId != -1) {
            c = connections.get(deviceId);
            if (c == null) { call.reject("DEVICE_NOT_CONNECTED"); return; }
        } else {
            if (connections.size() == 1) {
                c = connections.values().iterator().next();
            } else {
                call.reject("MULTIPLE_DEVICES_SPECIFY_DEVICEID");
                return;
            }
        }

        if (c == null || c.conn == null || c.outEndpoint == null) { call.reject("NOT_CONNECTED"); return; }

        byte[] data = null;
        if (message != null) {
            data = message.getBytes();
        } else {
            String b64 = call.getString("data");
            if (b64 != null) {
                try { data = android.util.Base64.decode(b64, android.util.Base64.DEFAULT); } catch (IllegalArgumentException e) { call.reject("INVALID_BASE64"); return; }
            }
        }
        if (data == null) { call.reject("NO_DATA_PROVIDED"); return; }

        int sentBytes = c.conn.bulkTransfer(c.outEndpoint, data, data.length, 5000);
        if (sentBytes < 0) {
            Log.e(TAG, "Error sending message to device " + (deviceId != -1 ? deviceId : "(single)"));
            call.reject("ERROR_SEND");
        } else {
            JSObject ret = new JSObject();
            ret.put("code", "OK");
            ret.put("message", "Message sent successfully");
            call.resolve(ret);
        }
    }

    public void controlTransfer(PluginCall call) {
        int deviceId = call.getInt("deviceId", -1);
        Connection c = null;
        if (deviceId != -1) {
            c = connections.get(deviceId);
            if (c == null) { call.reject("DEVICE_NOT_CONNECTED"); return; }
        } else {
            if (connections.size() == 1) c = connections.values().iterator().next(); else { call.reject("MULTIPLE_DEVICES_SPECIFY_DEVICEID"); return; }
        }

        if (c == null || c.conn == null) { call.reject("NOT_CONNECTED"); return; }

        int requestType = call.getInt("requestType");
        int request = call.getInt("request");
        int value = call.getInt("value");
        int index = call.getInt("index");
        int timeout = call.getInt("timeout", 5000);

        byte[] buffer = null;
        String dataB64 = call.getString("data");
        if (dataB64 != null) {
            try { buffer = android.util.Base64.decode(dataB64, android.util.Base64.DEFAULT); } catch (IllegalArgumentException e) { call.reject("INVALID_BASE64"); return; }
        }

        try {
            int res;
            if (buffer != null) res = c.conn.controlTransfer(requestType, request, value, index, buffer, buffer.length, timeout); else res = c.conn.controlTransfer(requestType, request, value, index, null, 0, timeout);
            JSObject out = new JSObject();
            out.put("code", "OK");
            out.put("result", res);
            call.resolve(out);
        } catch (Exception e) {
            call.reject("CONTROL_TRANSFER_FAILED");
        }
    }

    public void disconnect(PluginCall call) {
        try {
            int deviceId = call.getInt("deviceId", -1);
            if (deviceId != -1) {
                closeConnection(deviceId);
            } else {
                // if only one connection, close it
                if (connections.size() == 1) {
                    int id = connections.keySet().iterator().next();
                    closeConnection(id);
                } else {
                    call.reject("MULTIPLE_DEVICES_SPECIFY_DEVICEID");
                    return;
                }
            }
            JSObject ret = new JSObject();
            ret.put("code", "OK");
            ret.put("message", "disconnected");
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("ERROR_DISCONNECT");
        }
    }

    public void isConnected(PluginCall call) {
        int deviceId = call.getInt("deviceId", -1);
        JSObject ret = new JSObject();
        if (deviceId != -1) {
            ret.put("connected", connections.containsKey(deviceId));
            ret.put("deviceId", deviceId);
        } else {
            ret.put("connected", connections.size() > 0);
            ret.put("count", connections.size());
        }
        call.resolve(ret);
    }
}
