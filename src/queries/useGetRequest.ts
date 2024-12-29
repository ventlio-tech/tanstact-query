import { QueryKey, useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { startTransition, useEffect, useMemo, useState } from 'react';
import { useEnvironmentVariables } from '../config';

import { useStore } from '@tanstack/react-store';
import { bootStore } from '../config/bootStore';
import { IRequestError, IRequestSuccess, makeRequest } from '../request';
import { useHeaderStore, usePauseFutureRequests } from '../stores';
import { DefaultRequestOptions, IPagination, TanstackQueryOption } from './queries.interface';

export const useGetRequest = <TResponse extends Record<string, any>>({
  path,
  load = false,
  queryOptions,
  keyTracker,
  baseUrl,
  headers,
}: {
  path: string;
  load?: boolean;
  queryOptions?: TanstackQueryOption<TResponse>;
  keyTracker?: string;
} & DefaultRequestOptions) => {
  const [requestPath, setRequestPath] = useState<string>(path);
  const [options, setOptions] = useState<any>(queryOptions);
  const [page, setPage] = useState<number>(1);

  const { API_URL, TIMEOUT } = useEnvironmentVariables();
  const { middleware } = useStore(bootStore);

  const globalHeaders = useHeaderStore((state) => state.headers);

  const [requestPayload, setRequestPayload] = useState<Record<any, any>>();

  const isFutureQueriesPaused = usePauseFutureRequests((state) => state.isFutureQueriesPaused);

  let queryClient = useQueryClient();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  queryClient = useMemo(() => queryClient, []);

  const sendRequest = async (
    res: (
      value: IRequestError | IRequestSuccess<TResponse> | PromiseLike<IRequestError | IRequestSuccess<TResponse>>
    ) => void,
    rej: (reason?: any) => void,
    queryKey: QueryKey
  ) => {
    const [url] = queryKey;
    const requestUrl = (url ?? requestPath) as string;

    const requestOptions = {
      path: requestUrl,
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
      res(getResponse as IRequestSuccess<TResponse>);
    } else {
      rej(getResponse);
    }
  };

  const query = useQuery<any, any, IRequestSuccess<TResponse>>({
    queryKey: [requestPath, {}],
    queryFn: ({ queryKey }) =>
      new Promise<IRequestSuccess<TResponse> | IRequestError>((res, rej) => sendRequest(res, rej, queryKey)),
    enabled: load && !isFutureQueriesPaused,
    ...options,
  });

  useEffect(() => {
    if (path) {
      setRequestPath(path);
    }
  }, [path]);

  useEffect(() => {
    if (keyTracker) {
      // set expiration time for the tracker
      queryClient.setQueryDefaults([keyTracker], {
        staleTime: Infinity,
      });

      queryClient.setQueryData([keyTracker], [requestPath, {}]);
    }
  }, [keyTracker, requestPath, queryClient, queryOptions?.staleTime]);

  const nextPage = () => {
    if (query.data.data.pagination) {
      const pagination: IPagination = query.data.data.pagination;
      if (pagination.next_page !== pagination.current_page && pagination.next_page > pagination.current_page) {
        setRequestPath(constructPaginationLink(requestPath, pagination.next_page));
      }
    }
  };

  const prevPage = () => {
    if (query.data.data.pagination) {
      const pagination: IPagination = query.data.data.pagination;
      if (pagination.previous_page !== pagination.current_page && pagination.previous_page < pagination.current_page) {
        setRequestPath(constructPaginationLink(requestPath, pagination.previous_page));
      }
    }
  };

  const constructPaginationLink = (link: string, pageNumber: number) => {
    const [pathname, queryString] = link.split('?');
    const queryParams = new URLSearchParams(queryString);

    const oldPage = Number(queryParams.get('page'));

    queryParams.set('page', pageNumber as any);

    link = pathname + '?' + queryParams.toString();

    // only update page when pagination number changed
    if (oldPage !== pageNumber) {
      setPage(pageNumber);
    }
    return link;
  };

  const gotoPage = (pageNumber: number) => {
    setRequestPath(constructPaginationLink(requestPath, pageNumber));
  };

  const updatedPathAsync = async (link: string) => {
    startTransition(() => {
      setRequestPath(link);
    });
  };

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
  ): Promise<IRequestSuccess<TResponse> | undefined> => {
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

  return {
    ...query,
    isLoading: (query.isLoading as boolean) || isFutureQueriesPaused,
    setRequestPath,
    nextPage,
    prevPage,
    get,
    gotoPage,
    page,
    queryKey: [requestPath, {}],
  };
};
