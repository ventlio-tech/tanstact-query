import type { InfiniteData, UseQueryOptions } from '@tanstack/react-query';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { startTransition, useEffect, useMemo, useState } from 'react';
import { useEnvironmentVariables } from '../config';

import { useStore } from '@tanstack/react-store';
import { bootStore } from '../config/bootStore';
import type { IRequestError, IRequestSuccess } from '../request';
import { makeRequest } from '../request';
import { useHeaderStore, usePauseFutureRequests } from '../stores';
import type { DefaultRequestOptions, TanstackInfiniteQueryOption } from './queries.interface';

interface Pagination {
  previous_page: number;
  current_page: number;
  next_page: number;
  size: number;
  page_count: number;
  total: number;
}

export const useGetInfiniteRequest = <TResponse extends Record<string, any>>({
  path,
  load = false,
  queryOptions,
  keyTracker,
  baseUrl,
  headers,
}: {
  path: string;
  load?: boolean;
  queryOptions?: TanstackInfiniteQueryOption<TResponse & { pagination: Pagination }>;
  keyTracker?: string;
} & DefaultRequestOptions) => {
  const { API_URL, TIMEOUT } = useEnvironmentVariables();
  const globalHeaders = useHeaderStore((state) => state.headers);
  const [requestPath, setRequestPath] = useState<string>(path);

  const [options, setOptions] = useState<any>(queryOptions);
  const { middleware } = useStore(bootStore);

  const [requestPayload, setRequestPayload] = useState<Record<any, any>>();

  const isFutureQueriesPaused = usePauseFutureRequests((state) => state.isFutureQueriesPaused);

  let queryClient = useQueryClient();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  queryClient = useMemo(() => queryClient, []);

  const sendRequest = async (
    res: (
      value:
        | IRequestError
        | IRequestSuccess<TResponse & { pagination: Pagination }>
        | PromiseLike<IRequestError | IRequestSuccess<TResponse & { pagination: Pagination }>>
    ) => void,
    rej: (reason?: any) => void,
    pageParam?: string
  ) => {
    if (load) {
      // get request headers

      const requestOptions = {
        path: pageParam ?? requestPath,
        headers: { ...globalHeaders, ...headers },
        baseURL: baseUrl ?? API_URL,
        timeout: TIMEOUT,
      };

      let getResponse: IRequestError | IRequestSuccess<TResponse>;
      if (middleware) {
        // perform global middleware
        getResponse = await middleware(
          async (middlewareOptions) =>
            await makeRequest<TResponse>(
              middlewareOptions ? { ...requestOptions, ...middlewareOptions } : requestOptions
            ),
          {
            path,
            baseUrl: baseUrl ?? API_URL,
          }
        );
      } else {
        getResponse = await makeRequest<TResponse>(requestOptions);
      }

      if (getResponse.status) {
        res(getResponse as IRequestSuccess<TResponse & { pagination: Pagination }>);
      } else {
        rej(getResponse);
      }
    } else {
      rej(null);
    }
  };

  /**
   *
   * This pagination implementation is currently tied to our use case
   */
  const constructPaginationLink = (
    direction: 'next_page' | 'previous_page',
    lastPage: IRequestSuccess<
      TResponse & {
        pagination: Pagination;
      }
    >
  ) => {
    const [pathname, queryString] = requestPath.split('?');

    const queryParams = new URLSearchParams(queryString);
    const lastPageItem = lastPage.data.pagination[direction];

    queryParams.set('page', String(lastPageItem));

    return pathname + '?' + queryParams.toString();
  };

  const query = useInfiniteQuery<any, any, InfiniteData<IRequestSuccess<TResponse & { pagination: Pagination }>>>({
    queryKey: [requestPath, {}],
    queryFn: ({ pageParam = requestPath }) =>
      new Promise<IRequestSuccess<TResponse & { pagination: Pagination }> | IRequestError>((res, rej) =>
        sendRequest(res, rej, pageParam as string)
      ),
    enabled: load && !isFutureQueriesPaused,
    getNextPageParam: (lastPage) => constructPaginationLink('next_page', lastPage),
    getPreviousPageParam: (lastPage) => constructPaginationLink('previous_page', lastPage),
    ...options,
  });

  const setOptionsAsync = async (fetchOptions: any) => {
    startTransition(() => {
      setOptions(fetchOptions);
    });
  };

  const get = async (
    link: string,
    fetchOptions?: UseQueryOptions<
      IRequestSuccess<TResponse | undefined>,
      IRequestError,
      IRequestSuccess<TResponse | undefined>,
      Array<any>
    >
  ): Promise<
    | InfiniteData<
        IRequestSuccess<
          TResponse & {
            pagination: Pagination;
          }
        >
      >
    | undefined
  > => {
    if (!isFutureQueriesPaused) {
      await setOptionsAsync(fetchOptions);
      await updatedPathAsync(link);

      return query.data;
    } else {
      setRequestPayload({ link, fetchOptions });
      return undefined;
    }
  };

  useEffect(() => {
    if (!isFutureQueriesPaused && requestPayload) {
      get(requestPayload.link, requestPayload.fetchOptions);
      setRequestPayload(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFutureQueriesPaused]);

  const updatedPathAsync = async (link: string) => {
    startTransition(() => {
      setRequestPath(link);
    });
  };

  useEffect(() => {
    if (keyTracker) {
      // set expiration time for the tracker
      queryClient.setQueryDefaults([keyTracker], {
        staleTime: Infinity,
      });

      queryClient.setQueryData([keyTracker], [requestPath, {}]);
    }
  }, [keyTracker, requestPath, queryClient, queryOptions?.staleTime]);

  return {
    get,
    ...query,
    isLoading: (query.isLoading as boolean) || isFutureQueriesPaused,
  };
};
