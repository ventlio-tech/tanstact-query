import type { MutateOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { useEnvironmentVariables, useReactNativeEnv } from '../config';

import { useStore } from '@tanstack/react-store';
import { useEffect, useState } from 'react';
import { bootStore } from '../config/bootStore';
import { scrollToTop } from '../helpers';
import { useUploadProgress } from '../hooks';
import type { IMakeRequest, IRequestError, IRequestSuccess } from '../request';
import { HttpMethod, makeRequest } from '../request';
import { useHeaderStore, usePauseFutureRequests } from '../stores';
import type { DefaultRequestOptions } from './queries.interface';

export const usePostRequest = <TResponse>({
  path,
  isFormData = false,
  baseUrl,
  headers,
  fileSelectors,
}: {
  path: string;
  isFormData?: boolean;
  fileSelectors?: string[];
} & DefaultRequestOptions) => {
  const { API_URL, TIMEOUT } = useEnvironmentVariables();

  const { middleware, context } = useStore(bootStore);

  const globalHeaders = useHeaderStore((state) => state.headers);
  const { isApp } = useReactNativeEnv();
  const { uploadProgressPercent, onUploadProgress } = useUploadProgress();
  const [requestPayload, setRequestPayload] = useState<Record<any, any>>();

  const isFutureMutationsPaused = usePauseFutureRequests((state) => state.isFutureMutationsPaused);

  const sendRequest = async (
    res: (value: any) => void,
    rej: (reason?: any) => void,
    postData: { data: any; requestConfig?: Partial<IMakeRequest> }
  ) => {
    // get request headers

    const { data, requestConfig } = postData;

    delete requestConfig?.body;

    const requestOptions = {
      path,
      body: data,
      method: HttpMethod.POST,
      isFormData,
      headers: { ...globalHeaders, ...headers },
      baseURL: baseUrl ?? API_URL,
      timeout: TIMEOUT,
      appFileConfig: {
        isApp,
        fileSelectors,
      },
      onUploadProgress,
      ...requestConfig,
    };

    let postResponse: IRequestError | IRequestSuccess<TResponse>;
    if (middleware) {
      // perform global middleware
      postResponse = await middleware(
        async (options) => await makeRequest<TResponse>(options ? { ...requestOptions, ...options } : requestOptions),
        {
          path,
          baseUrl: baseUrl ?? API_URL,
          body: data,
        }
      );
    } else {
      postResponse = await makeRequest<TResponse>(requestOptions);
    }

    if (postResponse.status) {
      // scroll to top after success

      if (context !== 'app') {
        scrollToTop();
      }
      res(postResponse as IRequestSuccess<TResponse>);
    } else {
      // scroll to top after error
      if (context !== 'app') {
        scrollToTop();
      }
      rej(postResponse);
    }
  };

  // register post mutation
  const mutation = useMutation<
    IRequestSuccess<TResponse>,
    IRequestError,
    { data: any; requestConfig?: Partial<Omit<IMakeRequest, 'body'>> }
  >({
    mutationKey: [path, { type: 'mutation' }],
    mutationFn: async (postData) =>
      new Promise<IRequestSuccess<TResponse>>((res, rej) => sendRequest(res, rej, postData)),
  });

  const post = async <T>(
    data?: T,
    options?: (
      | MutateOptions<
          IRequestSuccess<TResponse>,
          IRequestError,
          { data: T; requestConfig?: Partial<Omit<IMakeRequest, 'body'>> },
          unknown
        >
      | { requestConfig?: Partial<Omit<IMakeRequest, 'body'>> }
      | undefined
    ) & { requestConfig?: Partial<Omit<IMakeRequest, 'body'>> }
  ): Promise<IRequestSuccess<TResponse> | undefined> => {
    if (!isFutureMutationsPaused) {
      const { requestConfig, ...otherOptions } = options ?? {};
      return mutation.mutateAsync({ data, requestConfig }, otherOptions);
    } else {
      setRequestPayload({ data, options });
      return undefined;
    }
  };

  useEffect(() => {
    if (!isFutureMutationsPaused && requestPayload) {
      post(requestPayload.data, requestPayload.options);
      setRequestPayload(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFutureMutationsPaused]);

  return { post, uploadProgressPercent, ...mutation, isLoading: mutation.isPending || isFutureMutationsPaused };
};
