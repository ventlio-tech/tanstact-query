import { Store } from '@tanstack/react-store';
import { BootstrapConfig } from '../types';

export const bootStore = new Store<BootstrapConfig>({
  context: 'web',
  environments: {
    appBaseUrl: undefined as any,
    appTimeout: 30000,
  },
  middleware: (next) => {
    return next();
  },
  modelConfig: undefined,
});
