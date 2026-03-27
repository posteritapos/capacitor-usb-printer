export interface UsbPrinterPlugin {
  echo(options: { value: string }): Promise<{ value: string }>;
  checkForDevices(options?: { vendorId?: number; productId?: number }): Promise<{ code?: string; message: string }>;
  listDevices(): Promise<{ devices: Array<any> }>;
  connectToDevice(options: { deviceId?: number; vendorId?: number; productId?: number }): Promise<{ code?: string; message: string; deviceId?: number }>;
  sendMessage(options: { deviceId?: number; message?: string; data?: string /* base64 */ }): Promise<{ code?: string; message: string }>;
  controlTransfer(options: { deviceId?: number; requestType: number; request: number; value: number; index: number; data?: string /* base64 */; timeout?: number }): Promise<{ code?: string; message?: string; response?: string /* base64 */ }>;
  disconnect(options?: { deviceId?: number }): Promise<{ code?: string; message?: string }>;
  isConnected(options?: { deviceId?: number }): Promise<{ connected: boolean; count?: number; deviceId?: number }>;
}
