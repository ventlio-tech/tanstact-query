import type { MutateOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { useStore } from '@tanstack/react-store';
import { useEffect, useState } from 'react';
import { useEnvironmentVariables } from '../config';
import { bootStore } from '../config/bootStore';
import { scrollToTop } from '../helpers';
import { useUploadProgress } from '../hooks';
import { HttpMethod, makeRequest } from '../request';
import type { IRequestError, IRequestSuccess } from '../request/request.interface';
import { useHeaderStore, usePauseFutureRequests } from '../stores';
import type { DefaultRequestOptions } from './queries.interface';

export const usePatchRequest = <TResponse>({ path, baseUrl, headers }: { path: string } & DefaultRequestOptions) => {
  const { API_URL, TIMEOUT } = useEnvironmentVariables();
  const { uploadProgressPercent, onUploadProgress } = useUploadProgress();
  const globalHeaders = useHeaderStore((state) => state.headers);

  const [requestPayload, setRequestPayload] = useState<Record<any, any>>();

  const isFutureMutationsPaused = usePauseFutureRequests((state) => state.isFutureMutationsPaused);
  const { middleware, context } = useStore(bootStore);

  const sendRequest = async (res: (value: any) => void, rej: (reason?: any) => void, data: any) => {
    // get request headers

    const requestOptions = {
      path: path,
      body: data,
      method: HttpMethod.PATCH,
      headers: { ...globalHeaders, ...headers },
      baseURL: baseUrl ?? API_URL,
      timeout: TIMEOUT,
      onUploadProgress,
    };

    let patchResponse: IRequestError | IRequestSuccess<TResponse>;
    if (middleware) {
      // perform global middleware
      const middlewareResponse = await middleware(
        async (options) => await makeRequest<TResponse>(options ? { ...requestOptions, ...options } : requestOptions),
        {
          path,
          baseUrl: baseUrl ?? API_URL,
          body: data,
        }
      );

      patchResponse = middlewareResponse;
    } else {
      patchResponse = await makeRequest<TResponse>(requestOptions);
    }
    if (patchResponse.status) {
      // scroll to top after success
      if (context !== 'app') {
        scrollToTop();
      }
      res(patchResponse as IRequestSuccess<TResponse>);
    } else {
      // scroll to top after error
      if (context !== 'app') {
        scrollToTop();
      }
      rej(patchResponse);
    }
  };

  // register post mutation
  const mutation = useMutation<IRequestSuccess<TResponse>, IRequestError>({
    mutationKey: [path, { type: 'mutation' }],
    mutationFn: (dataData: any) =>
      new Promise<IRequestSuccess<TResponse>>((res, rej) => {
        return sendRequest(res, rej, dataData);
      }),
  });

  const patch = async (
    data: any,
    options?: MutateOptions<IRequestSuccess<TResponse>, IRequestError, void, unknown> | undefined
  ): Promise<IRequestSuccess<TResponse> | undefined> => {
    if (!isFutureMutationsPaused) {
      return mutation.mutateAsync(data, options);
    } else {
      setRequestPayload({ data, options });
      return undefined;
    }
  };

  useEffect(() => {
    if (!isFutureMutationsPaused && requestPayload) {
      patch(requestPayload.data, requestPayload.options);
      setRequestPayload(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFutureMutationsPaused]);

  return { patch, uploadProgressPercent, ...mutation, isLoading: mutation.isPending || isFutureMutationsPaused };
};
