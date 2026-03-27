import { WebPlugin } from '@capacitor/core';

import type { UsbPrinterPlugin } from './definitions';

export class UsbPrinterWeb extends WebPlugin implements UsbPrinterPlugin {
  async echo(options: { value: string }): Promise<{ value: string }> {
    console.log('ECHO', options);
    return options;
  }
  async checkForDevices(options?: { vendorId?: number; productId?: number }): Promise<{ message: string }> {
    console.warn('checkForDevices is not implemented on web');
    return Promise.reject('checkForDevices not available on web');
  }

  async connectToDevice(): Promise<{ code?: string; message?: string; deviceId?: number }> {
    console.warn('connectToDevice is not implemented on web');
    return Promise.reject('connectToDevice not available on web');
  }

  async sendMessage(options: { deviceId?: number; message?: string; data?: string }): Promise<{ code?: string; message?: string }> {
    console.warn('sendMessage is not implemented on web');
    return Promise.reject('sendMessage not available on web');
  }
  async listDevices(): Promise<{ devices: Array<any> }> {
    console.warn('listDevices is not implemented on web');
    return Promise.reject('listDevices not available on web');
  }

  async controlTransfer(options: { deviceId?: number; requestType: number; request: number; value: number; index: number; data?: string; timeout?: number }): Promise<{ code?: string; message?: string; response?: string }> {
    console.warn('controlTransfer is not implemented on web');
    return Promise.reject('controlTransfer not available on web');
  }
  async disconnect(options?: { deviceId?: number }): Promise<{ code?: string; message?: string }> {
    console.warn('disconnect is not implemented on web');
    return Promise.reject('disconnect not available on web');
  }

  async isConnected(options?: { deviceId?: number }): Promise<{ connected: boolean }> {
    return { connected: false };
  }
}
