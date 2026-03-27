package com.posterita.capacitor.plugin.printer.usb;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import android.util.Log;

import androidx.annotation.Nullable;

@CapacitorPlugin(name = "UsbPrinter")
public class UsbPrinterPlugin extends Plugin {

    private UsbPrinter implementation = new UsbPrinter();
    private static final String TAG = "UsbPrinterPlugin";

    @Override
    public void load() {
        super.load();
        try {
            implementation.initialize(getContext());
            implementation.setPlugin(this);
        } catch (Exception e) {
            Log.w(TAG, "Initialization failed", e);
        }
    }

    @PluginMethod
    public void checkForDevices(PluginCall call) {
        implementation.initialize(getContext());
        implementation.checkForDevices(call);
    }

    @PluginMethod
    public void listDevices(PluginCall call) {
        implementation.initialize(getContext());
        implementation.listDevices(call);
    }

    @PluginMethod
    public void connectToDevice(PluginCall call) {
        implementation.initialize(getContext());
        implementation.connectToDevice(call);
    }

    @PluginMethod
    public void sendMessage(PluginCall call) {
        implementation.initialize(getContext());
        String message = call.getString("message");
        implementation.sendMessage(call, message);
    }

    @PluginMethod
    public void controlTransfer(PluginCall call) {
        implementation.controlTransfer(call);
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        implementation.disconnect(call);
    }

    @PluginMethod
    public void isConnected(PluginCall call) {
        implementation.isConnected(call);
    }

    public void onDestroy() {
        try {
            implementation.destroy();
        } catch (Exception e) {
            Log.w(TAG, "Destroy failed", e);
        }
    }
}
