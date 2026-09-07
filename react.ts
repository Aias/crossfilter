import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import crossfilter from "./index.js";
import type { Crossfilter, Dimension, FilterValue, Group, GroupAll, Grouping } from "./index.js";

interface ChangeStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): number;
}

interface Snapshot<R> {
  version: number;
  read: () => R;
  value: R;
}

const stores = new WeakMap<object, ChangeStore>();

function storeFor<T>(source: Crossfilter<T>): ChangeStore {
  const existing = stores.get(source);
  if (existing) return existing;
  let version = 0;
  const listeners = new Set<() => void>();
  source.onChange(() => {
    version += 1;
    for (const listener of listeners) listener();
  });
  const store: ChangeStore = {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => version,
  };
  stores.set(source, store);
  return store;
}

export function useCrossfilterVersion<T>(source: Crossfilter<T>): number {
  const store = storeFor(source);
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

export function useCrossfilterSnapshot<T, R>(source: Crossfilter<T>, read: () => R): R {
  const store = storeFor(source);
  const snapshot = useRef<Snapshot<R>>(null);
  return useSyncExternalStore(store.subscribe, () => {
    const version = store.getSnapshot();
    const current = snapshot.current;
    if (current !== null && current.version === version && current.read === read) {
      return current.value;
    }
    const value = read();
    snapshot.current = { version, read, value };
    return value;
  });
}

export function useCrossfilter<T, Model>(
  records: readonly T[],
  build: (source: Crossfilter<T>) => Model,
): Model {
  const [{ source, model }] = useState(() => {
    const created = crossfilter(records);
    return { source: created, model: build(created) };
  });
  const loaded = useRef(records);
  useEffect(() => {
    if (loaded.current === records) return;
    loaded.current = records;
    source.remove(() => true);
    source.add(records);
  }, [records, source]);
  return model;
}

export function useGroupAll<T, K, V>(
  source: Crossfilter<T>,
  group: Group<T, K, V>,
): Grouping<K, V>[] {
  const read = useCallback(() => group.all().slice(), [group]);
  return useCrossfilterSnapshot(source, read);
}

export function useGroupTop<T, K, V>(
  source: Crossfilter<T>,
  group: Group<T, K, V>,
  k: number,
): Grouping<K, V>[] {
  const read = useCallback(() => group.top(k), [group, k]);
  return useCrossfilterSnapshot(source, read);
}

export function useGroupValue<T, V>(source: Crossfilter<T>, group: GroupAll<T, V>): V {
  const read = useCallback(() => group.value(), [group]);
  return useCrossfilterSnapshot(source, read);
}

export function useDimensionTop<T, V, A>(
  source: Crossfilter<T>,
  dimension: Dimension<T, V, A>,
  k: number,
  offset = 0,
): T[] {
  const read = useCallback(() => dimension.top(k, offset), [dimension, k, offset]);
  return useCrossfilterSnapshot(source, read);
}

export function useDimensionBottom<T, V, A>(
  source: Crossfilter<T>,
  dimension: Dimension<T, V, A>,
  k: number,
  offset = 0,
): T[] {
  const read = useCallback(() => dimension.bottom(k, offset), [dimension, k, offset]);
  return useCrossfilterSnapshot(source, read);
}

export type DimensionFilterSetter<V> = (value?: FilterValue<V> | null) => void;

export function useDimensionFilter<T, V, A>(
  source: Crossfilter<T>,
  dimension: Dimension<T, V, A>,
): [FilterValue<V> | undefined, DimensionFilterSetter<V>] {
  const read = useCallback(() => dimension.currentFilter(), [dimension]);
  const setFilter = useCallback<DimensionFilterSetter<V>>(
    (value) => {
      dimension.filter(value);
    },
    [dimension],
  );
  return [useCrossfilterSnapshot(source, read), setFilter];
}
