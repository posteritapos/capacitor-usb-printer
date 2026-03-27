export interface UsbPrinterPlugin {
  echo(options: { value: string }): Promise<{ value: string }>;
}
