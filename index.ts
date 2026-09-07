import xfilterArray from "./src/array.js";
import createDimension from "./src/dimension.js";
import type { Dimension as DimensionType } from "./src/dimension.js";
import createGroupAll from "./src/groupAll.js";
import type { GroupAll as GroupAllType } from "./src/groupAll.js";
import xfilterHeapselect from "./src/heapselect.js";
import xfilterHeap from "./src/heap.js";
import bisection from "./src/bisect.js";
import permutation from "./src/permute.js";
import result from "./src/result.js";
import { version as packageVersion } from "./package.json";
import { REMOVED_INDEX } from "./src/indexes.js";
import type { CrossfilterState, EventName } from "./src/state.js";

export interface DimensionId {
  id(): number;
}

type IterableValue<V> = V extends ArrayLike<infer Item> ? Item : never;
type DimensionValue<V, I extends boolean> = I extends true ? IterableValue<V> : V;
type NormalizedPath<P extends string> = P extends `${infer Head}[${infer Key}]${infer Rest}`
  ? `${Head}.${Key}${NormalizedPath<Rest>}`
  : P;
type Step<T, K extends string> = K extends keyof T
  ? T[K]
  : T extends readonly unknown[]
    ? K extends `${number}`
      ? T[number]
      : unknown
    : unknown;
type Called<V> = V extends (...args: never[]) => infer Result ? Result : V;
type Walk<T, P extends string> = P extends `${infer Head}.${infer Rest}`
  ? Walk<Step<T, Head>, Rest>
  : Called<Step<T, P>>;
export type PathValue<T, P extends string> = Walk<T, NormalizedPath<P>>;

export interface Crossfilter<T> {
  add(records: readonly T[]): Crossfilter<T>;
  remove(predicate?: (record: T, index: number) => boolean): void;
  dimension<V>(value: (record: T) => V, iterable?: false): DimensionType<T, V>;
  dimension<V extends ArrayLike<unknown>, I extends boolean>(
    value: (record: T) => V,
    iterable: I,
  ): DimensionType<T, DimensionValue<V, I>, V>;
  dimension<P extends string, V = PathValue<T, P>>(value: P, iterable?: false): DimensionType<T, V>;
  dimension<P extends string, I extends boolean, V = PathValue<T, P>>(
    value: P,
    iterable: I,
  ): DimensionType<T, DimensionValue<V, I>, V>;
  groupAll(): GroupAllType<T, number>;
  size(): number;
  all(): T[];
  allFiltered(ignoreDimensions?: readonly DimensionId[]): T[];
  onChange(callback: (event: EventName) => void): () => void;
  isElementFiltered(index: number, ignoreDimensions?: readonly DimensionId[]): boolean;
}

function crossfilter<T>(records?: readonly T[]): Crossfilter<T> {
  const callbacks: ((event: EventName) => void)[] = [];
  const state: CrossfilterState<T> = {
    data: [],
    n: 0,
    filters: new xfilterArray.bitarray(0),
    filterListeners: [],
    dataListeners: [],
    removeDataListeners: [],
    triggerOnChange,
  };
  const crossfilter: Crossfilter<T> = {
    add,
    remove: removeData,
    dimension,
    groupAll,
    size,
    all,
    allFiltered,
    onChange,
    isElementFiltered,
  };

  function add(newData: readonly T[]) {
    const n0 = state.n;
    const n1 = newData.length;
    if (n1) {
      state.data = state.data.concat(newData);
      state.filters.lengthen((state.n += n1));
      state.dataListeners.forEach((listener) => listener(newData, n0, n1));
      triggerOnChange("dataAdded");
    }
    return crossfilter;
  }

  function removeData(predicate?: (record: T, index: number) => boolean) {
    const newIndex = new Array<number>(state.n);
    const removed: number[] = [];
    for (let index1 = 0, index2 = 0; index1 < state.n; ++index1) {
      if (predicate ? predicate(state.data[index1], index1) : state.filters.zero(index1)) {
        removed.push(index1);
        newIndex[index1] = REMOVED_INDEX;
      } else {
        newIndex[index1] = index2++;
      }
    }
    state.filterListeners.forEach((listener) => listener(-1, -1, [], removed, true));
    state.removeDataListeners.forEach((listener) => listener(newIndex));
    let index4 = 0;
    for (let index3 = 0; index3 < state.n; ++index3) {
      if (newIndex[index3] !== REMOVED_INDEX) {
        if (index3 !== index4) {
          state.filters.copy(index4, index3);
          state.data[index4] = state.data[index3];
        }
        ++index4;
      }
    }
    state.data.length = state.n = index4;
    state.filters.truncate(index4);
    triggerOnChange("dataRemoved");
  }

  function maskForDimensions(dimensions: readonly DimensionId[]) {
    const mask = new Array<number>(state.filters.subarrays);
    for (let n = 0; n < state.filters.subarrays; n++) mask[n] = ~0;
    for (let d = 0; d < dimensions.length; d++) {
      const id = dimensions[d].id();
      mask[id >> 7] &= ~(0x1 << (id & 0x3f));
    }
    return mask;
  }

  function isElementFiltered(index: number, ignoreDimensions: readonly DimensionId[] = []) {
    return state.filters.zeroExceptMask(index, maskForDimensions(ignoreDimensions));
  }

  function dimension<V>(value: (record: T) => V, iterable?: false): DimensionType<T, V>;
  function dimension<V extends ArrayLike<unknown>, I extends boolean>(
    value: (record: T) => V,
    iterable: I,
  ): DimensionType<T, DimensionValue<V, I>, V>;
  function dimension<P extends string, V = PathValue<T, P>>(
    value: P,
    iterable?: false,
  ): DimensionType<T, V>;
  function dimension<P extends string, I extends boolean, V = PathValue<T, P>>(
    value: P,
    iterable: I,
  ): DimensionType<T, DimensionValue<V, I>, V>;
  function dimension(value: ((record: T) => unknown) | string, iterable = false) {
    const accessor = typeof value === "string" ? (record: T) => result(record, value) : value;
    if (iterable) {
      const readValues = (record: T) => {
        const values = accessor(record);
        if (!isIterableValue(values))
          throw new TypeError("Iterable dimension accessor must return an array-like value");
        return values;
      };
      return createDimension(state, { value: readValues, accessor, iterable: true });
    }
    return createDimension(state, { value: accessor, accessor, iterable: false });
  }

  function groupAll() {
    return createGroupAll(state);
  }

  function size() {
    return state.n;
  }

  function all() {
    return state.data;
  }

  function allFiltered(ignoreDimensions: readonly DimensionId[] = []) {
    const array: T[] = [];
    const mask = maskForDimensions(ignoreDimensions);
    for (let i = 0; i < state.n; i++) {
      if (state.filters.zeroExceptMask(i, mask)) array.push(state.data[i]);
    }
    return array;
  }

  function onChange(callback: (event: EventName) => void): () => void;
  function onChange(callback: (event: EventName) => void) {
    if (typeof callback !== "function") {
      console.warn("onChange callback parameter must be a function!");
      return undefined;
    }
    callbacks.push(callback);
    return function () {
      callbacks.splice(callbacks.indexOf(callback), 1);
    };
  }

  function triggerOnChange(event: EventName) {
    for (let i = 0; i < callbacks.length; i++) callbacks[i](event);
  }

  return records ? add(records) : crossfilter;
}

function isIterableValue(value: unknown): value is ArrayLike<unknown> {
  return (
    typeof value === "string" ||
    (typeof value === "object" &&
      value !== null &&
      "length" in value &&
      typeof value.length === "number")
  );
}

export default crossfilter;

type CrossfilterOf<T> = Crossfilter<T>;
type DimensionOf<T, V, A = V> = DimensionType<T, V, A>;
type GroupOf<T, K, V> = import("./src/group.js").Group<T, K, V>;
type GroupAllOf<T, V> = GroupAllType<T, V>;
type GroupingOf<K, V> = import("./src/group.js").Grouping<K, V>;
type ComparableObjectOf = import("./src/order.js").ComparableObject;
type NaturallyOrderedValueOf = import("./src/order.js").NaturallyOrderedValue;
type FilterValueOf<V> = import("./src/dimension.js").FilterValue<V>;
type Permutation = typeof permutation;

namespace crossfilter {
  export const version = packageVersion;
  export const heap = xfilterHeap;
  export const heapselect = xfilterHeapselect;
  export const bisect = bisection;
  export const permute: Permutation = permutation;
  export type Crossfilter<T> = CrossfilterOf<T>;
  export type Dimension<T, V, A = V> = DimensionOf<T, V, A>;
  export type Group<T, K, V> = GroupOf<T, K, V>;
  export type GroupAll<T, V> = GroupAllOf<T, V>;
  export type Grouping<K, V> = GroupingOf<K, V>;
  export type ComparableValue = string | number | boolean;
  export type ComparableObject = ComparableObjectOf;
  export type NaturallyOrderedValue = NaturallyOrderedValueOf;
  export type Predicate<T> = (record: T) => boolean;
  export type TSelectorValue = NaturallyOrderedValue | NaturallyOrderedValue[];
  export type OrderedValueSelector<T, V = NaturallyOrderedValue> = (record: T) => V;
  export type FilterValue<V = NaturallyOrderedValue> = FilterValueOf<V>;
  export type HeapSelector<T> = (records: T[], lo: number, hi: number, k: number) => T[];
  export type Heap<T> = Sorter<T> & { sort: Sorter<T> };
  export type Sorter<T> = (records: T[], lo: number, hi: number) => T[];
  export type Bisection<T> = (records: T[], record: T, lo: number, hi: number) => number;
  export type Bisector<T> = Bisection<T> & { left: Bisection<T>; right: Bisection<T> };
}

export type { Dimension, FilterPredicate, FilterValue } from "./src/dimension.js";
export type { Group, Grouping } from "./src/group.js";
export type { GroupAll, Reducer } from "./src/groupAll.js";
export type { ComparableObject, NaturallyOrderedValue } from "./src/order.js";
export type { EventName } from "./src/state.js";
