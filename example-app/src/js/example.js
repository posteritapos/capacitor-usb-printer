import { UsbPrinter } from 'capacitor-usb-printer';

window.testEcho = () => {
    const inputValue = document.getElementById("echoInput").value;
    UsbPrinter.echo({ value: inputValue })
}
