import { WebPlugin } from '@capacitor/core';

import type { UsbPrinterPlugin } from './definitions';

export class UsbPrinterWeb extends WebPlugin implements UsbPrinterPlugin {
  async echo(options: { value: string }): Promise<{ value: string }> {
    console.log('ECHO', options);
    return options;
  }
}
