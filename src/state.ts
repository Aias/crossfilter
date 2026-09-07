import type xfilterArray from "./array.js";

export type EventName = "dataAdded" | "dataRemoved" | "filtered";
export type FilterListener = (
  one: number,
  offset: number,
  added: number[],
  removed: number[],
  notFilter?: boolean,
) => void;
export type DataListener<T> = (newData: T[], n0: number, n1: number) => void;
export type RemoveListener = (newIndex: number[]) => void;
export type IndexListener<V> = (newValues: V[], newIndex: number[], n0: number, n1: number) => void;

export interface CrossfilterState<T> {
  data: T[];
  n: number;
  filters: InstanceType<typeof xfilterArray.bitarray>;
  filterListeners: FilterListener[];
  dataListeners: DataListener<T>[];
  removeDataListeners: RemoveListener[];
  triggerOnChange(event: EventName): void;
}

export interface DimensionGroupState<V> {
  values: V[];
  index: number[];
  iterable: boolean;
  offset: number;
  one: number;
  zero: number;
  indexListeners: IndexListener<V>[];
  dimensionGroups: { dispose(): unknown }[];
}
