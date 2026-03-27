package com.posterita.capacitor.plugin.printer.usb;

import com.getcapacitor.Logger;

public class UsbPrinter {

    public String echo(String value) {
        Logger.info("Echo", value);
        return value;
    }
}
