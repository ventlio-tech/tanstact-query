import type { QueryClient } from '@tanstack/react-query';
import 'url-search-params-polyfill';
import type { BootstrapConfig } from '../types';
import { bootStore } from './bootStore';

export const bootstrapQueryRequest = async (queryClient: QueryClient, options: BootstrapConfig): Promise<void> => {
  // set default query config
  await queryClient.resumePausedMutations();

  bootStore.setState(() => options);
};
