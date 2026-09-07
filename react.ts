import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import crossfilter from "./index.js";
import type { Crossfilter, Dimension, FilterValue, Group, GroupAll, Grouping } from "./index.js";

interface ChangeStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): number;
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
  const version = useCrossfilterVersion(source);
  return useMemo(() => group.all().slice(), [group, version]);
}

export function useGroupTop<T, K, V>(
  source: Crossfilter<T>,
  group: Group<T, K, V>,
  k: number,
): Grouping<K, V>[] {
  const version = useCrossfilterVersion(source);
  return useMemo(() => group.top(k), [group, k, version]);
}

export function useGroupValue<T, V>(source: Crossfilter<T>, group: GroupAll<T, V>): V {
  useCrossfilterVersion(source);
  return group.value();
}

export function useDimensionTop<T, V, A>(
  source: Crossfilter<T>,
  dimension: Dimension<T, V, A>,
  k: number,
  offset = 0,
): T[] {
  const version = useCrossfilterVersion(source);
  return useMemo(() => dimension.top(k, offset), [dimension, k, offset, version]);
}

export function useDimensionBottom<T, V, A>(
  source: Crossfilter<T>,
  dimension: Dimension<T, V, A>,
  k: number,
  offset = 0,
): T[] {
  const version = useCrossfilterVersion(source);
  return useMemo(() => dimension.bottom(k, offset), [dimension, k, offset, version]);
}

export type DimensionFilterSetter<V> = (value?: FilterValue<V> | null) => void;

export function useDimensionFilter<T, V, A>(
  source: Crossfilter<T>,
  dimension: Dimension<T, V, A>,
): [FilterValue<V> | undefined, DimensionFilterSetter<V>] {
  useCrossfilterVersion(source);
  const setFilter = useCallback<DimensionFilterSetter<V>>(
    (value) => {
      dimension.filter(value);
    },
    [dimension],
  );
  return [dimension.currentFilter(), setFilter];
}
