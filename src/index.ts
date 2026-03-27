import { registerPlugin } from '@capacitor/core';

import type { UsbPrinterPlugin } from './definitions';

const UsbPrinter = registerPlugin<UsbPrinterPlugin>('UsbPrinter', {
  web: () => import('./web').then((m) => new m.UsbPrinterWeb()),
});

export * from './definitions';
export { UsbPrinter };
