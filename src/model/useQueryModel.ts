import { useQueryClient } from '@tanstack/react-query';
import { useStore } from '@tanstack/react-store';
import result from 'lodash.result';
import { default as lodashSet } from 'lodash.set';
import { bootStore } from '../config/bootStore';
import type { QueryModelAddPosition, QueryModelBuilder } from './model.interface';
import { useKeyTrackerModel } from './useKeyTrackerModel';

export const useQueryModel = <T>(keyTracker: string): QueryModelBuilder<T> => {
  const queryClient = useQueryClient();
  const { getQueryKey } = useKeyTrackerModel(keyTracker);
  const queryKey = getQueryKey() as any[];
  const config = useStore(bootStore);

  const add = (data: T, position?: QueryModelAddPosition, path?: string): T | undefined => {
    let records = (findAll(path) ?? []) as T[];

    if (!position || position === 'end') {
      records = [...records, data];
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    } else if (position === 'start') {
      records = [data, ...records];
    }

    if (!path) {
      queryClient.setQueryData(queryKey, records);
    } else {
      const queryData = queryClient.getQueryData(queryKey) ?? {};
      queryClient.setQueryData(queryKey, lodashSet(queryData, path, records));
    }

    return data;
  };

  const findAll = (path?: string): T[] | T | undefined => {
    const data = queryClient.getQueryData(queryKey);

    if (!data) {
      return [];
    }

    if (!path) {
      return Array.isArray(data) ? data : [data];
    }

    return result<T[]>(data, path, []);
  };

  const findMany = (selector: (record: T) => boolean, path?: string): T[] => {
    const data = (findAll(path) ?? []) as T[];
    return data.filter(selector);
  };

  const find = (id: string | number, path?: string): T | undefined => {
    const modelConfig = getModelConfig();

    if (!modelConfig?.idColumn) {
      return undefined;
    }
    const data = (findAll(path) ?? []) as T[];

    return data.find((record) => (record as Record<string, any>)[modelConfig.idColumn] === id);
  };

  const get = (path?: string): T | undefined => {
    let data = queryClient.getQueryData(queryKey);
    if (path) {
      data = result<T>(data, path);
    }
    return data as T;
  };

  const set = <DataType>(newData: Partial<DataType>, path?: string): DataType | undefined => {
    if (path) {
      const data = get() as any;
      newData = lodashSet(data, path, newData);
    }

    return queryClient.setQueryData(queryKey, () => newData as any) as DataType;
  };

  const getModelConfig = () => {
    const { modelConfig } = config;

    return modelConfig;
  };

  const update = (id: string | number, data: Partial<T>, path?: string): T | undefined => {
    const oldData = (findAll(path) ?? []) as T[];
    const modelConfig = getModelConfig();

    if (!modelConfig?.idColumn) {
      return undefined;
    }
    const idColumn = modelConfig.idColumn;

    let updatedRecord: T | undefined = undefined;
    const newData = oldData.map((record) => {
      let dataRecord = record as Record<string, any>;
      if (dataRecord[idColumn] === id) {
        dataRecord = { ...dataRecord, ...data };
        updatedRecord = dataRecord as T;
      }

      return dataRecord;
    });

    if (!path) {
      queryClient.setQueryData(queryKey, newData);
    } else {
      const queryData = queryClient.getQueryData(queryKey) ?? {};
      queryClient.setQueryData(queryKey, lodashSet(queryData, path, newData));
    }
    return updatedRecord;
  };

  const remove = (id: number | string, path?: string): boolean => {
    const oldData = (findAll(path) ?? []) as T[];
    const modelConfig = getModelConfig();

    if (!modelConfig?.idColumn) {
      return false;
    }
    const idColumn = modelConfig.idColumn;
    let updated = false;
    const newData = oldData.filter((record) => {
      const dataRecord = record as Record<string, any>;
      if (dataRecord[idColumn] === id) {
        updated = true;
        return false;
      }
      return true;
    });

    if (!path) {
      queryClient.setQueryData(queryKey, newData);
    } else {
      const queryData = queryClient.getQueryData(queryKey) ?? {};
      queryClient.setQueryData(queryKey, lodashSet(queryData, path, newData));
    }
    return updated;
  };

  return { find, findAll, findMany, remove, update, add, get, set };
};
