import { useStore } from '@tanstack/react-store';
import { bootStore } from './bootStore';

export const useReactNativeEnv = () => {
  const { environments, context } = useStore(bootStore);

  const appUrl: string | undefined = environments?.appBaseUrl;
  const appTimeout: number | undefined = environments?.appTimeout;
  const isApp = context === 'app';

  return { appUrl, appTimeout, isApp };
};
