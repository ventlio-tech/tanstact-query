import type { AxiosProgressEvent, RawAxiosRequestHeaders } from 'axios';
import type { AppFileConfig, HttpMethod, IMakeRequest, IRequestError, IRequestSuccess } from '../request';

export interface BootstrapConfig {
  environments?: {
    appBaseUrl: string;
    appTimeout: number;
  };
  context?: ContextType;
  modelConfig?: BootstrapModelConfig;
  middleware?: <T = any>(
    next: (options?: Partial<NextOptions>) => Promise<IRequestSuccess<T> | IRequestError>,
    configs?: { baseUrl: string; path: string; body?: Record<string, any> }
  ) => Promise<IRequestError | IRequestSuccess<T>>;
}

export interface NextOptions extends Partial<IMakeRequest> {
  baseURL: string;
  timeout: number;
  path: string;
  body: any;
  method: HttpMethod;
  isFormData: boolean;
  headers: RawAxiosRequestHeaders;
  appFileConfig: AppFileConfig;
  onUploadProgress: (progressEvent: AxiosProgressEvent) => void;
}

export interface BootstrapModelConfig {
  idColumn: string;
}

export type ContextType = 'app' | 'web' | 'electronjs';
export interface TanstackQueryConfig {
  options?: BootstrapConfig;
}

export interface IUseQueryHeaders {
  getHeaders: () => QueryHeaders;
  setQueryHeaders: (header: QueryHeaders) => void;
}

export type QueryHeaders = RawAxiosRequestHeaders | undefined;
