import xfilterArray, { Bitarray, NumberArray } from './array.js';
import xfilterFilter from './filter.js';
import cr_identity from './identity.js';
import cr_zero from './zero.js';
import xfilterHeapselect from './heapselect.js';
import xfilterHeap from './heap.js';
import bisect from './bisect.js';
import permute from './permute.js';
import xfilterReduce from './reduce.js';
import result from './result.js';

// Type definitions
type ComparableValue = string | number | boolean;
type NaturallyOrderedValue = ComparableValue | { valueOf(): ComparableValue } | null | undefined;
type GroupKey = NaturallyOrderedValue;
type Predicate<T> = (record: T, index: number) => boolean;
type ValueAccessor<T, V> = ((record: T) => V) | string;

type FilterFn<V> = { bivarianceHack(value: V, index: number): boolean }['bivarianceHack'];
type FilterValue<V> = V | [V, V] | FilterFn<V>;

type ReducerAdd<T, V> = { bivarianceHack(p: V, v: T, nf: boolean, j?: number): V }['bivarianceHack'];
type ReducerRemove<T, V> = { bivarianceHack(p: V, v: T, nf: boolean, j?: number): V }['bivarianceHack'];
type ReducerInitial<V> = () => V;
type OrderValue<V> = { bivarianceHack(d: V): number }['bivarianceHack'];

interface Grouping<K, V> {
  key: K;
  value: V;
}

type FilterListener = (one: number, offset: number, added: number[], removed: number[], notFilter?: boolean) => void;
type DataListener<T> = (newData: T[], n0: number, n1: number) => void;
type RemoveDataListener = (newIndex: number[]) => void;
type IndexListener<V> = (newValues: V[], newIndex: NumberArray, n0: number, n1: number) => void;

// Discriminated union for groupIndex - 1D for normal dimensions, 2D for iterable dimensions
type GroupIndex =
  | { kind: '1d'; data: NumberArray }
  | { kind: '2d'; data: number[][] };

// No-op functions matching listener signatures for use as placeholders
const noopFilterListener: FilterListener = () => { /* no-op */ };
const noopReset: () => void = () => { /* no-op */ };


interface DimensionGroup<T, K, V> {
  top(k: number): Array<Grouping<K, V>>;
  all(): Array<Grouping<K, V>>;
  reduce(
    add: ReducerAdd<T, V>,
    remove: ReducerRemove<T, V>,
    initial: ReducerInitial<V>
  ): DimensionGroup<T, K, V>;
  reduceCount(): DimensionGroup<T, K, V>;
  reduceSum(value: (record: T) => number): DimensionGroup<T, K, V>;
  order(value: OrderValue<V>): DimensionGroup<T, K, V>;
  orderNatural(): DimensionGroup<T, K, V>;
  size(): number;
  dispose(): DimensionGroup<T, K, V>;
  remove(): DimensionGroup<T, K, V>;
}

interface DimensionGroupAll<T, V> {
  reduce(
    add: ReducerAdd<T, V>,
    remove: ReducerRemove<T, V>,
    initial: ReducerInitial<V>
  ): DimensionGroupAll<T, V>;
  reduceCount(): DimensionGroupAll<T, V>;
  reduceSum(value: (record: T) => number): DimensionGroupAll<T, V>;
  value(): V;
  dispose(): DimensionGroupAll<T, V>;
  remove(): DimensionGroupAll<T, V>;
}

interface Dimension<T, V extends NaturallyOrderedValue> {
  filter(range: FilterValue<V> | null): Dimension<T, V>;
  filterExact(value: V): Dimension<T, V>;
  filterRange(range: [V, V]): Dimension<T, V>;
  filterFunction(f: FilterFn<V>): Dimension<T, V>;
  filterAll(): Dimension<T, V>;
  currentFilter(): FilterValue<V> | undefined;
  hasCurrentFilter(): boolean | undefined;
  top(k: number, offset?: number): T[];
  bottom(k: number, offset?: number): T[];
  group<K extends NaturallyOrderedValue = V>(key?: (value: V) => K): DimensionGroup<T, K, number>;
  groupAll(): DimensionGroupAll<T, number>;
  dispose(): Dimension<T, V>;
  remove(): Dimension<T, V>;
  accessor: ValueAccessor<T, V | ArrayLike<V>>;
  id(): number;
}

interface CrossfilterGroupAll<T, V> {
  reduce(
    add: ReducerAdd<T, V>,
    remove: ReducerRemove<T, V>,
    initial: ReducerInitial<V>
  ): CrossfilterGroupAll<T, V>;
  reduceCount(): CrossfilterGroupAll<T, V>;
  reduceSum(value: (record: T) => number): CrossfilterGroupAll<T, V>;
  value(): V;
  dispose(): CrossfilterGroupAll<T, V>;
  remove(): CrossfilterGroupAll<T, V>;
}

interface CrossfilterInstance<T> {
  add: (newData: T[]) => CrossfilterInstance<T>;
  remove: (predicate?: Predicate<T>) => void;
  dimension: {
    <V extends NaturallyOrderedValue>(value: ValueAccessor<T, V>, iterable?: false): Dimension<T, V>;
    <V extends NaturallyOrderedValue>(value: ValueAccessor<T, V[]>, iterable: true): Dimension<T, V>;
  };
  groupAll: () => CrossfilterGroupAll<T, number>;
  size: () => number;
  all: () => T[];
  allFiltered: (ignore_dimensions?: Array<{ id: () => number }>) => T[];
  onChange: (cb: (eventName: string) => void) => () => void;
  isElementFiltered: (i: number, ignore_dimensions?: Array<{ id: () => number }>) => boolean;
}

interface CrossfilterStatic {
  <T>(records?: T[]): CrossfilterInstance<T>;
  heap: typeof xfilterHeap;
  heapselect: typeof xfilterHeapselect;
  bisect: typeof bisect;
  permute: typeof permute;
  version?: string;
}

// constants
const REMOVED_INDEX = -1;

const toComparableValue = (value: NaturallyOrderedValue): ComparableValue | null | undefined => {
  if (value == null) return value;
  if (typeof value === 'object') return value.valueOf();
  return value;
};

const compareNaturallyOrdered = (a: NaturallyOrderedValue, b: NaturallyOrderedValue): number => {
  const av = toComparableValue(a);
  const bv = toComparableValue(b);

  if (typeof av === 'string' && typeof bv === 'string') {
    return av < bv ? -1 : av > bv ? 1 : 0;
  }

  const an = Number(av);
  const bn = Number(bv);
  return an < bn ? -1 : an > bn ? 1 : 0;
};

const compareGroupKeys = (a: GroupKey, b: GroupKey): number => {
  return compareNaturallyOrdered(a, b);
};

const isNaNValue = (value: GroupKey): boolean => {
  const comparable = toComparableValue(value);
  if (comparable === undefined) return true;
  return typeof comparable === 'number' && Number.isNaN(comparable);
};


const crossfilter: CrossfilterStatic = function crossfilter<T>(initialData?: T[]): CrossfilterInstance<T> {
  const cf: CrossfilterInstance<T> = {
    add: add,
    remove: removeData,
    dimension: dimension,
    groupAll: groupAll,
    size: size,
    all: all,
    allFiltered: allFiltered,
    onChange: onChange,
    isElementFiltered: isElementFiltered
  };

  let data: T[] = []; // the records
  let n = 0; // the number of records; data.length
  let filters: Bitarray; // 1 is filtered out
  const filterListeners: FilterListener[] = []; // when the filters change
  const dataListeners: DataListener<T>[] = []; // when data is added
  const removeDataListeners: RemoveDataListener[] = []; // when data is removed
  const callbacks: Array<(eventName: string) => void> = [];

  filters = new xfilterArray.bitarray(0);

  // Adds the specified new records to this crossfilter.
  function add(newData: T[]): CrossfilterInstance<T> {
    const n0 = n;
    const n1 = newData.length;

    if (n1) {
      data = data.concat(newData);
      filters.lengthen(n += n1);
      dataListeners.forEach(function(l) { l(newData, n0, n1); });
      triggerOnChange('dataAdded');
    }

    return cf;
  }

  // Removes all records that match the current filters, or if a predicate function is passed,
  // removes all records matching the predicate (ignoring filters).
  function removeData(predicate?: Predicate<T>): void {
    const newIndex = new Array<number>(n);
    const removed: number[] = [];
    const usePred = typeof predicate === 'function';
    const shouldRemove = (i: number): boolean => {
      return usePred ? predicate!(data[i], i) : filters.zero(i);
    };

    for (let index1 = 0, index2 = 0; index1 < n; ++index1) {
      if (shouldRemove(index1)) {
        removed.push(index1);
        newIndex[index1] = REMOVED_INDEX;
      } else {
        newIndex[index1] = index2++;
      }
    }

    // Remove all matching records from groups.
    filterListeners.forEach(function(l) { l(-1, -1, [], removed, true); });

    // Update indexes.
    removeDataListeners.forEach(function(l) { l(newIndex); });

    // Remove old filters and data by overwriting.
    let index3: number, index4: number;
    for (index3 = 0, index4 = 0; index3 < n; ++index3) {
      if (newIndex[index3] !== REMOVED_INDEX) {
        if (index3 !== index4) {
          filters.copy(index4, index3);
          data[index4] = data[index3];
        }
        ++index4;
      }
    }

    data.length = n = index4;
    filters.truncate(index4);
    triggerOnChange('dataRemoved');
  }

  function maskForDimensions(dimensions: Array<{ id: () => number }>): number[] {
    const mask = new Array<number>(filters.subarrays);
    for (let i = 0; i < filters.subarrays; i++) { mask[i] = ~0; }
    for (let d = 0, len = dimensions.length; d < len; d++) {
      const id = dimensions[d].id();
      mask[id >> 7] &= ~(0x1 << (id & 0x3f));
    }
    return mask;
  }

  // Return true if the data element at index i is filtered IN.
  function isElementFiltered(i: number, ignore_dimensions?: Array<{ id: () => number }>): boolean {
    const mask = maskForDimensions(ignore_dimensions || []);
    return filters.zeroExceptMask(i, mask);
  }

  // Adds a new dimension with the specified value accessor function.
  function dimension<V extends NaturallyOrderedValue>(value: ValueAccessor<T, V>, iterable?: false): Dimension<T, V>;
  function dimension<V extends NaturallyOrderedValue>(value: ValueAccessor<T, ArrayLike<V>>, iterable: true): Dimension<T, V>;
  function dimension<V extends NaturallyOrderedValue>(value: ValueAccessor<T, V> | ValueAccessor<T, ArrayLike<V>>, iterable?: boolean): Dimension<T, V> {
    function makeValueAccessor<VValue>(accessor: ValueAccessor<T, VValue>): (d: T) => VValue {
      if (typeof accessor === 'string') {
        const accessorPath = accessor;
        return function(d: T): VValue { return result<VValue>(d, accessorPath); };
      }
      return accessor;
    }

    function isIterableValueAccessor(
      accessor: ValueAccessor<T, V> | ValueAccessor<T, ArrayLike<V>>,
      isIterable?: boolean
    ): accessor is ValueAccessor<T, ArrayLike<V>> {
      return isIterable === true;
    }

    let accessorFn: (d: T) => V | ArrayLike<V>;
    let iterableAccessor: ((d: T) => ArrayLike<V>) | null = null;
    let nonIterableAccessor: ((d: T) => V) | null = null;

    if (isIterableValueAccessor(value, iterable)) {
      iterableAccessor = makeValueAccessor<ArrayLike<V>>(value);
      accessorFn = iterableAccessor;
    } else {
      nonIterableAccessor = makeValueAccessor<V>(value);
      accessorFn = nonIterableAccessor;
    }

    const dim: Dimension<T, V> = {
      filter: filter,
      filterExact: filterExact,
      filterRange: filterRange,
      filterFunction: filterFunction,
      filterAll: filterAll,
      currentFilter: currentFilter,
      hasCurrentFilter: hasCurrentFilter,
      top: top,
      bottom: bottom,
      group: group,
      groupAll: dimGroupAll,
      dispose: dispose,
      remove: dispose,
      accessor: accessorFn,
      id: function() { return id; }
    };

    let one: number; // lowest unset bit as mask
    let zero: number; // inverted one
    let offset: number; // offset into the filters arrays
    let id: number; // unique ID for this dimension
    let values: V[] = []; // sorted, cached array
    let index: NumberArray = []; // maps sorted value index -> record index
    let newValues: V[] = []; // temporary array storing newly-added values
    let newIndex: NumberArray = []; // temporary array storing newly-added index
    let iterablesIndexCount: NumberArray = [];
    let iterablesIndexFilterStatus: NumberArray = [];
    let iterablesEmptyRows: number[] = [];

    const sortRange = function(n: number): number[] {
      // Convert to regular array to ensure Array.prototype.sort signature
      return Array.from(cr_range(n)).sort(function(A: number, B: number) {
        const cmp = compareNaturallyOrdered(newValues[A], newValues[B]);
        return cmp !== 0 ? cmp : A - B;
      });
    };

    let refilter: (values: V[]) => [number, number] = xfilterFilter.filterAll;
    let refilterFunction: FilterFn<V> | null = null;
    let filterValue: FilterValue<V> | undefined;
    let filterValuePresent = false;
    let filterEverApplied = false;
    const indexListeners: IndexListener<V>[] = [];
    const dimensionGroups: Array<{ dispose: () => void }> = [];
    let lo0 = 0;
    let hi0 = 0;
    let t = 0;

    // Updating a dimension is a two-stage process.
    dataListeners.unshift(preAdd);
    dataListeners.push(postAdd);
    removeDataListeners.push(removeData);

    // Add a new dimension in the filter bitmap
    const tmp = filters.add();
    offset = tmp.offset;
    one = tmp.one;
    zero = ~one;

    // Create a unique ID for the dimension
    id = (offset << 7) | (Math.log(one) / Math.log(2));

    preAdd(data, 0, n);
    postAdd(data, 0, n);

    function preAdd(newData: T[], n0: number, n1: number): void {
      let newIterablesIndexCount: NumberArray = [];
      let newIterablesIndexFilterStatus: NumberArray = [];
      let i0: number;
      let j: number;
      const isIterable = iterable === true;

      if (isIterable) {
        const valueAccessor = iterableAccessor;
        if (!valueAccessor) return;
        t = 0;

        for (i0 = 0; i0 < newData.length; i0++) {
          const kArr = valueAccessor(newData[i0]);
          for (j = 0; j < kArr.length; j++) {
            t++;
          }
        }

        newValues = [];
        newIterablesIndexCount = cr_range(newData.length);
        newIterablesIndexFilterStatus = cr_index(t, 1);
        const unsortedIndex: NumberArray = cr_range(t);

        for (let l = 0, index1 = 0; index1 < newData.length; index1++) {
          const kArr = valueAccessor(newData[index1]);
          if (!kArr.length) {
            newIterablesIndexCount[index1] = 0;
            iterablesEmptyRows.push(index1 + n0);
            continue;
          }
          newIterablesIndexCount[index1] = kArr.length;
          for (j = 0; j < kArr.length; j++) {
            newValues.push(kArr[j]);
            unsortedIndex[l] = index1;
            l++;
          }
        }

        const sortMap = sortRange(t);
        newValues = permute(newValues, sortMap);
        newIndex = permute(unsortedIndex, sortMap);
      } else {
        const valueAccessor = nonIterableAccessor;
        if (!valueAccessor) return;
        newValues = newData.map(valueAccessor);
        newIndex = sortRange(n1);
        newValues = permute(newValues, newIndex);
      }

      const bounds = refilter(newValues);
      let lo1 = bounds[0];
      let hi1 = bounds[1];

      let index2: number, index3: number, index4: number;
      if (isIterable) {
        n1 = t;
        if (refilterFunction) {
          for (index2 = 0; index2 < n1; ++index2) {
            if (!refilterFunction(newValues[index2], index2)) {
              if (--newIterablesIndexCount[newIndex[index2]] === 0) {
                filters.orAt(offset, newIndex[index2] + n0, one);
              }
              newIterablesIndexFilterStatus[index2] = 1;
            }
          }
        } else {
          for (index3 = 0; index3 < lo1; ++index3) {
            if (--newIterablesIndexCount[newIndex[index3]] === 0) {
              filters.orAt(offset, newIndex[index3] + n0, one);
            }
            newIterablesIndexFilterStatus[index3] = 1;
          }
          for (index4 = hi1; index4 < n1; ++index4) {
            if (--newIterablesIndexCount[newIndex[index4]] === 0) {
              filters.orAt(offset, newIndex[index4] + n0, one);
            }
            newIterablesIndexFilterStatus[index4] = 1;
          }
        }
      } else {
        if (refilterFunction) {
          for (index2 = 0; index2 < n1; ++index2) {
            if (!refilterFunction(newValues[index2], index2)) {
              filters.orAt(offset, newIndex[index2] + n0, one);
            }
          }
        } else {
          for (index3 = 0; index3 < lo1; ++index3) {
            filters.orAt(offset, newIndex[index3] + n0, one);
          }
          for (index4 = hi1; index4 < n1; ++index4) {
            filters.orAt(offset, newIndex[index4] + n0, one);
          }
        }
      }

      if (!n0) {
        values = newValues;
        index = newIndex;
        if (isIterable) {
          iterablesIndexCount = newIterablesIndexCount;
          iterablesIndexFilterStatus = newIterablesIndexFilterStatus;
        }
        lo0 = lo1;
        hi0 = hi1;
        return;
      }

      const oldValues = values;
      const oldIndex = index;
      const oldIterablesIndexFilterStatus = iterablesIndexFilterStatus;
      let old_n0 = 0;
      let i1 = 0;

      i0 = 0;

      if (iterable) {
        old_n0 = n0;
        n0 = oldValues.length;
        n1 = t;
      }

      values = iterable ? new Array<V>(n0 + n1) : new Array<V>(n);
      index = iterable ? new Array<number>(n0 + n1) : cr_index(n, n);
      if (iterable) iterablesIndexFilterStatus = cr_index(n0 + n1, 1);

      if (iterable) {
        const oldiiclength = iterablesIndexCount.length;
        iterablesIndexCount = xfilterArray.arrayLengthen(iterablesIndexCount, n);
        for (let j = 0; j + oldiiclength < n; j++) {
          iterablesIndexCount[j + oldiiclength] = newIterablesIndexCount[j];
        }
      }

      let index5 = 0;
      for (; i0 < n0 && i1 < n1; ++index5) {
        if (compareNaturallyOrdered(oldValues[i0], newValues[i1]) < 0) {
          values[index5] = oldValues[i0];
          if (iterable) iterablesIndexFilterStatus[index5] = oldIterablesIndexFilterStatus[i0];
          index[index5] = oldIndex[i0++];
        } else {
          values[index5] = newValues[i1];
          if (iterable) iterablesIndexFilterStatus[index5] = newIterablesIndexFilterStatus[i1];
          index[index5] = newIndex[i1++] + (iterable ? old_n0 : n0);
        }
      }

      for (; i0 < n0; ++i0, ++index5) {
        values[index5] = oldValues[i0];
        if (iterable) iterablesIndexFilterStatus[index5] = oldIterablesIndexFilterStatus[i0];
        index[index5] = oldIndex[i0];
      }

      for (; i1 < n1; ++i1, ++index5) {
        values[index5] = newValues[i1];
        if (iterable) iterablesIndexFilterStatus[index5] = newIterablesIndexFilterStatus[i1];
        index[index5] = newIndex[i1] + (iterable ? old_n0 : n0);
      }

      const bounds2 = refilter(values);
      lo0 = bounds2[0];
      hi0 = bounds2[1];
    }

    function postAdd(_newData: T[], n0: number, n1: number): void {
      indexListeners.forEach(function(l) { l(newValues, newIndex, n0, n1); });
      newValues = [];
      newIndex = [];
    }

    function removeData(reIndex: number[]): void {
      let i0: number, i1: number;
      if (iterable) {
        for (i0 = 0, i1 = 0; i0 < iterablesEmptyRows.length; i0++) {
          if (reIndex[iterablesEmptyRows[i0]] !== REMOVED_INDEX) {
            iterablesEmptyRows[i1] = reIndex[iterablesEmptyRows[i0]];
            i1++;
          }
        }
        iterablesEmptyRows.length = i1;
        for (i0 = 0, i1 = 0; i0 < n; i0++) {
          if (reIndex[i0] !== REMOVED_INDEX) {
            if (i1 !== i0) iterablesIndexCount[i1] = iterablesIndexCount[i0];
            i1++;
          }
        }
        iterablesIndexCount = iterablesIndexCount.slice(0, i1);
      }

      const n0 = values.length;
      let j = 0;
      let oldDataIndex: number;
      for (let i = 0; i < n0; ++i) {
        oldDataIndex = index[i];
        if (reIndex[oldDataIndex] !== REMOVED_INDEX) {
          if (i !== j) values[j] = values[i];
          index[j] = reIndex[oldDataIndex];
          if (iterable) {
            iterablesIndexFilterStatus[j] = iterablesIndexFilterStatus[i];
          }
          ++j;
        }
      }
      values.length = j;
      if (iterable) iterablesIndexFilterStatus = iterablesIndexFilterStatus.slice(0, j);
      while (j < n0) index[j++] = 0;

      const bounds = refilter(values);
      lo0 = bounds[0];
      hi0 = bounds[1];
    }

    function filterIndexBounds(bounds: [number, number]): Dimension<T, V> {
      const lo1 = bounds[0];
      const hi1 = bounds[1];

      if (refilterFunction) {
        refilterFunction = null;
        filterIndexFunction(function(_d: V, i: number) { return lo1 <= i && i < hi1; }, bounds[0] === 0 && bounds[1] === values.length);
        lo0 = lo1;
        hi0 = hi1;
        return dim;
      }

      let i: number;
      let j: number;
      let kIdx: number;
      const added: number[] = [];
      const removed: number[] = [];
      const valueIndexAdded: number[] = [];
      const valueIndexRemoved: number[] = [];

      if (lo1 < lo0) {
        for (i = lo1, j = Math.min(lo0, hi1); i < j; ++i) {
          added.push(index[i]);
          valueIndexAdded.push(i);
        }
      } else if (lo1 > lo0) {
        for (i = lo0, j = Math.min(lo1, hi0); i < j; ++i) {
          removed.push(index[i]);
          valueIndexRemoved.push(i);
        }
      }

      if (hi1 > hi0) {
        for (i = Math.max(lo1, hi0), j = hi1; i < j; ++i) {
          added.push(index[i]);
          valueIndexAdded.push(i);
        }
      } else if (hi1 < hi0) {
        for (i = Math.max(lo0, hi1), j = hi0; i < j; ++i) {
          removed.push(index[i]);
          valueIndexRemoved.push(i);
        }
      }

      let finalAdded = added;
      let finalRemoved = removed;

      if (!iterable) {
        for (i = 0; i < added.length; i++) {
          filters.xorAt(offset, added[i], one);
        }
        for (i = 0; i < removed.length; i++) {
          filters.xorAt(offset, removed[i], one);
        }
      } else {
        const newAdded: number[] = [];
        const newRemoved: number[] = [];
        for (i = 0; i < added.length; i++) {
          iterablesIndexCount[added[i]]++;
          iterablesIndexFilterStatus[valueIndexAdded[i]] = 0;
          if (iterablesIndexCount[added[i]] === 1) {
            filters.xorAt(offset, added[i], one);
            newAdded.push(added[i]);
          }
        }
        for (i = 0; i < removed.length; i++) {
          iterablesIndexCount[removed[i]]--;
          iterablesIndexFilterStatus[valueIndexRemoved[i]] = 1;
          if (iterablesIndexCount[removed[i]] === 0) {
            filters.xorAt(offset, removed[i], one);
            newRemoved.push(removed[i]);
          }
        }

        finalAdded = newAdded;
        finalRemoved = newRemoved;

        if (refilter === xfilterFilter.filterAll) {
          for (i = 0; i < iterablesEmptyRows.length; i++) {
            kIdx = iterablesEmptyRows[i];
            if ((filters.getAt(offset, kIdx) & one)) {
              filters.xorAt(offset, kIdx, one);
              finalAdded.push(kIdx);
            }
          }
        } else {
          for (i = 0; i < iterablesEmptyRows.length; i++) {
            kIdx = iterablesEmptyRows[i];
            if (!(filters.getAt(offset, kIdx) & one)) {
              filters.xorAt(offset, kIdx, one);
              finalRemoved.push(kIdx);
            }
          }
        }
      }

      lo0 = lo1;
      hi0 = hi1;
      filterListeners.forEach(function(l) { l(one, offset, finalAdded, finalRemoved); });
      triggerOnChange('filtered');
      return dim;
    }

    function filter(range: FilterValue<V> | null): Dimension<T, V> {
      if (range == null) return filterAll();
      if (Array.isArray(range)) return filterRange(range);
      if (typeof range === 'function') return filterFunction(range);
      return filterExact(range);
    }

    function filterExact(value: V): Dimension<T, V> {
      filterValue = value;
      filterValuePresent = true;
      filterEverApplied = true;
      return filterIndexBounds((refilter = xfilterFilter.filterExact(bisect, value))(values));
    }

    function filterRange(range: [V, V]): Dimension<T, V> {
      filterValue = range;
      filterValuePresent = true;
      filterEverApplied = true;
      return filterIndexBounds((refilter = xfilterFilter.filterRange(bisect, range))(values));
    }

    function filterAll(): Dimension<T, V> {
      filterValue = undefined;
      filterValuePresent = false;
      return filterIndexBounds((refilter = xfilterFilter.filterAll)(values));
    }

    function filterFunction(f: FilterFn<V>): Dimension<T, V> {
      // Store original function for currentFilter() to return
      filterValue = f;
      filterValuePresent = true;
      filterEverApplied = true;

      refilterFunction = f;
      refilter = xfilterFilter.filterAll;

      filterIndexFunction(f, false);

      const bounds = refilter(values);
      lo0 = bounds[0];
      hi0 = bounds[1];

      return dim;
    }

    function filterIndexFunction(f: FilterFn<V>, filterAll: boolean): void {
      let i: number;
      let kIdx: number;
      let x: boolean;
      let added: number[] = [];
      let removed: number[] = [];
      const valueIndexAdded: number[] = [];
      const valueIndexRemoved: number[] = [];
      const indexLength = values.length;

      if (!iterable) {
        for (i = 0; i < indexLength; ++i) {
          kIdx = index[i];
          if (!((filters.getAt(offset, kIdx) & one) !== 0) !== !!(x = f(values[i], i))) {
            if (x) added.push(kIdx);
            else removed.push(kIdx);
          }
        }
      }

      if (iterable) {
        for (i = 0; i < indexLength; ++i) {
          if (f(values[i], i)) {
            added.push(index[i]);
            valueIndexAdded.push(i);
          } else {
            removed.push(index[i]);
            valueIndexRemoved.push(i);
          }
        }
      }

      if (!iterable) {
        for (i = 0; i < added.length; i++) {
          if (filters.getAt(offset, added[i]) & one) filters.andAt(offset, added[i], zero);
        }
        for (i = 0; i < removed.length; i++) {
          if (!(filters.getAt(offset, removed[i]) & one)) filters.orAt(offset, removed[i], one);
        }
      } else {
        const newAdded: number[] = [];
        const newRemoved: number[] = [];
        for (i = 0; i < added.length; i++) {
          if (iterablesIndexFilterStatus[valueIndexAdded[i]] === 1) {
            iterablesIndexCount[added[i]]++;
            iterablesIndexFilterStatus[valueIndexAdded[i]] = 0;
            if (iterablesIndexCount[added[i]] === 1) {
              filters.xorAt(offset, added[i], one);
              newAdded.push(added[i]);
            }
          }
        }
        for (i = 0; i < removed.length; i++) {
          if (iterablesIndexFilterStatus[valueIndexRemoved[i]] === 0) {
            iterablesIndexCount[removed[i]]--;
            iterablesIndexFilterStatus[valueIndexRemoved[i]] = 1;
            if (iterablesIndexCount[removed[i]] === 0) {
              filters.xorAt(offset, removed[i], one);
              newRemoved.push(removed[i]);
            }
          }
        }

        added = newAdded;
        removed = newRemoved;

        if (filterAll) {
          for (i = 0; i < iterablesEmptyRows.length; i++) {
            kIdx = iterablesEmptyRows[i];
            if ((filters.getAt(offset, kIdx) & one)) {
              filters.xorAt(offset, kIdx, one);
              added.push(kIdx);
            }
          }
        } else {
          for (i = 0; i < iterablesEmptyRows.length; i++) {
            kIdx = iterablesEmptyRows[i];
            if (!(filters.getAt(offset, kIdx) & one)) {
              filters.xorAt(offset, kIdx, one);
              removed.push(kIdx);
            }
          }
        }
      }

      filterListeners.forEach(function(l) { l(one, offset, added, removed); });
      triggerOnChange('filtered');
    }

    function currentFilter(): FilterValue<V> | undefined {
      return filterValue;
    }

    function hasCurrentFilter(): boolean | undefined {
      if (!filterEverApplied) return undefined;
      return filterValuePresent;
    }

    function top(k: number, top_offset?: number): T[] {
      const array: T[] = [];
      let i = hi0;
      let j: number;
      let toSkip = 0;

      if (top_offset && top_offset > 0) toSkip = top_offset;

      while (--i >= lo0 && k > 0) {
        if (filters.zero(j = index[i])) {
          if (toSkip > 0) {
            --toSkip;
          } else {
            array.push(data[j]);
            --k;
          }
        }
      }

      if (iterable) {
        for (i = 0; i < iterablesEmptyRows.length && k > 0; i++) {
          if (filters.zero(j = iterablesEmptyRows[i])) {
            if (toSkip > 0) {
              --toSkip;
            } else {
              array.push(data[j]);
              --k;
            }
          }
        }
      }

      return array;
    }

    function bottom(k: number, bottom_offset?: number): T[] {
      const array: T[] = [];
      let i: number;
      let j: number;
      let toSkip = 0;

      if (bottom_offset && bottom_offset > 0) toSkip = bottom_offset;

      if (iterable) {
        for (i = 0; i < iterablesEmptyRows.length && k > 0; i++) {
          if (filters.zero(j = iterablesEmptyRows[i])) {
            if (toSkip > 0) {
              --toSkip;
            } else {
              array.push(data[j]);
              --k;
            }
          }
        }
      }

      i = lo0;

      while (i < hi0 && k > 0) {
        if (filters.zero(j = index[i])) {
          if (toSkip > 0) {
            --toSkip;
          } else {
            array.push(data[j]);
            --k;
          }
        }
        i++;
      }

      return array;
    }

    function group(): DimensionGroup<T, V, number>;
    function group<K extends NaturallyOrderedValue>(key: (value: V) => K): DimensionGroup<T, K, number>;
    function group<K extends NaturallyOrderedValue>(key?: (value: V) => K): DimensionGroup<T, GroupKey, number> {
      if (key) return createGroup(key, false);
      const identityKey = (value: V): V => value;
      return createGroup(identityKey, false);
    }

    function hasValue<K>(value: K | undefined): value is K {
      return value !== undefined;
    }

    function createGroup<K extends GroupKey>(
      keyFn: (value: V) => K,
      groupAllFlag: boolean,
      groupAllKey?: K
    ): DimensionGroup<T, K, number> {
      type GroupType = Grouping<K, number>;

      const grp: DimensionGroup<T, K, number> = {
        top: groupTop,
        all: groupAll,
        reduce: reduce,
        reduceCount: reduceCount,
        reduceSum: reduceSum,
        order: order,
        orderNatural: orderNatural,
        size: groupSize,
        dispose: groupDispose,
        remove: groupDispose
      };

      dimensionGroups.push(grp);

      let groups: GroupType[] = [];
      let groupIndex: GroupIndex = { kind: '1d', data: [] };
      let groupWidth = 8;
      let groupCapacity = capacity(groupWidth);
      let kVal = 0;
      let select = xfilterHeapselect.by((d: GroupType) => d.value);
      let heap = xfilterHeap.by((d: GroupType) => d.value);
      let reduceAdd: ReducerAdd<T, number> = xfilterReduce.reduceIncrement;
      let reduceRemove: ReducerRemove<T, number> = xfilterReduce.reduceDecrement;
      let reduceInitial: ReducerInitial<number> = cr_zero;
      let update: FilterListener = noopFilterListener;
      let reset: () => void = noopReset;
      let resetNeeded = true;
      let n0old = 0;

      filterListeners.push(update);
      indexListeners.push(addToGroup);
      removeDataListeners.push(removeGroupData);

      addToGroup(values, index, 0, n);

      function addToGroup(newValues: V[], newIndex: NumberArray, n0: number, n1: number): void {
        if (iterable) {
          n0old = n0;
          n0 = values.length - newValues.length;
          n1 = newValues.length;
        }

        const oldGroups = groups;
        let reIndex: NumberArray = iterable ? [] : cr_index(kVal, groupCapacity);
        const k0 = kVal;
        let i0 = 0;
        let i1 = 0;
        let j: number;
        let g0: GroupType | undefined;
        let x0: K | undefined;
        let x1: K | undefined;

        groups = new Array<GroupType>(kVal);
        kVal = 0;
        if (iterable) {
          groupIndex = k0 && groupIndex.kind === '2d'
            ? groupIndex
            : { kind: '2d', data: [] };
        } else {
          groupIndex = k0 > 1 && groupIndex.kind === '1d'
            ? lengthenGroupIndex(groupIndex, n)
            : { kind: '1d', data: cr_index(n, groupCapacity) };
        }

        if (k0) {
          g0 = oldGroups[0];
          x0 = g0.key;
        }

        while (i1 < n1) {
          x1 = keyFn(newValues[i1]);
          if (!isNaNValue(x1)) break;
          i1++;
        }

        while (i1 < n1 && x1 !== undefined) {
          let g: GroupType;
          let x: K;

          if (g0 && x0 !== undefined && compareGroupKeys(x0, x1) <= 0) {
            g = g0;
            x = x0;
            reIndex[i0] = kVal;
            g0 = oldGroups[++i0];
            if (g0) x0 = g0.key;
          } else {
            g = { key: x1, value: reduceInitial() };
            x = x1;
          }

          groups[kVal] = g;

          while (compareGroupKeys(x1, x) <= 0) {
            j = newIndex[i1] + (iterable ? n0old : n0);

            if (groupIndex.kind === '2d') {
              if (groupIndex.data[j]) {
                groupIndex.data[j].push(kVal);
              } else {
                groupIndex.data[j] = [kVal];
              }
            } else {
              groupIndex.data[j] = kVal;
            }

            if (!resetNeeded) {
              g.value = reduceAdd(g.value, data[j], true);
              if (!filters.zeroExcept(j, offset, zero)) g.value = reduceRemove(g.value, data[j], false);
            }

            i1++;
            if (i1 >= n1) break;
            x1 = keyFn(newValues[i1]);
            while (i1 < n1 && isNaNValue(x1)) {
              i1++;
              if (i1 >= n1) break;
              x1 = keyFn(newValues[i1]);
            }
            if (i1 >= n1) break;
          }

          groupIncrement();
        }

        while (i0 < k0) {
          groups[reIndex[i0] = kVal] = oldGroups[i0++];
          groupIncrement();
        }

        if (groupIndex.kind === '2d') {
          for (let index1 = 0; index1 < n; index1++) {
            if (!groupIndex.data[index1]) {
              groupIndex.data[index1] = [];
            }
          }
        }

        if (kVal > i0) {
          if (groupIndex.kind === '2d') {
            for (i0 = 0; i0 < n0old; ++i0) {
              for (let index1 = 0; index1 < groupIndex.data[i0].length; index1++) {
                groupIndex.data[i0][index1] = reIndex[groupIndex.data[i0][index1]];
              }
            }
          } else {
            for (i0 = 0; i0 < n0; ++i0) {
              groupIndex.data[i0] = reIndex[groupIndex.data[i0]];
            }
          }
        }

        j = filterListeners.indexOf(update);
        if (kVal > 1 || iterable) {
          update = updateMany;
          reset = resetMany;
        } else {
          if (!kVal && groupAllFlag && hasValue(groupAllKey)) {
            kVal = 1;
            groups = [{ key: groupAllKey, value: reduceInitial() }];
          }
          if (kVal === 1) {
            update = updateOne;
            reset = resetOne;
          } else {
            update = noopFilterListener;
            reset = noopReset;
          }
          groupIndex = { kind: '1d', data: [] };
        }
        filterListeners[j] = update;

        function groupIncrement(): void {
          if (iterable) {
            kVal++;
            return;
          }
          if (++kVal === groupCapacity) {
            reIndex = xfilterArray.arrayWiden(reIndex, groupWidth <<= 1);
            groupIndex = widenGroupIndex(groupIndex, groupWidth);
            groupCapacity = capacity(groupWidth);
          }
        }
      }

      function removeGroupData(reIndex: number[]): void {
        if (kVal > 1 || iterable) {
          const oldK = kVal;
          const oldGroups = groups;
          const seenGroups: NumberArray = cr_index(oldK, oldK);
          let i: number;
          let i0: number;
          let j: number;

          if (groupIndex.kind === '1d') {
            for (i = 0, j = 0; i < n; ++i) {
              if (reIndex[i] !== REMOVED_INDEX) {
                seenGroups[groupIndex.data[j] = groupIndex.data[i]] = 1;
                ++j;
              }
            }
          } else {
            for (i = 0, j = 0; i < n; ++i) {
              if (reIndex[i] !== REMOVED_INDEX) {
                groupIndex.data[j] = groupIndex.data[i];
                for (i0 = 0; i0 < groupIndex.data[j].length; i0++) {
                  seenGroups[groupIndex.data[j][i0]] = 1;
                }
                ++j;
              }
            }
            groupIndex = { kind: '2d', data: groupIndex.data.slice(0, j) };
          }

          groups = [];
          kVal = 0;
          for (i = 0; i < oldK; ++i) {
            if (seenGroups[i]) {
              seenGroups[i] = kVal++;
              groups.push(oldGroups[i]);
            }
          }

          if (kVal > 1 || iterable) {
            if (groupIndex.kind === '1d') {
              for (i = 0; i < j; ++i) groupIndex.data[i] = seenGroups[groupIndex.data[i]];
            } else {
              for (i = 0; i < j; ++i) {
                for (i0 = 0; i0 < groupIndex.data[i].length; ++i0) {
                  groupIndex.data[i][i0] = seenGroups[groupIndex.data[i][i0]];
                }
              }
            }
          }
          filterListeners[filterListeners.indexOf(update)] = kVal > 1 || iterable
            ? (reset = resetMany, update = updateMany)
            : kVal === 1 ? (reset = resetOne, update = updateOne)
              : (reset = noopReset, update = noopFilterListener);
        } else if (kVal === 1) {
          if (groupAllFlag) return;
          for (let index3 = 0; index3 < n; ++index3) if (reIndex[index3] !== REMOVED_INDEX) return;
          groups = [];
          kVal = 0;
          reset = noopReset;
          filterListeners[filterListeners.indexOf(update)] = update = noopFilterListener;
        }
      }

      function updateMany(filterOne: number, filterOffset: number, added: number[], removed: number[], notFilter?: boolean): void {
        if ((filterOne === one && filterOffset === offset) || resetNeeded) return;

        const notFilterValue = notFilter === true;
        let i: number;
        let j: number;
        let kIdx: number;
        let nLen: number;
        let g: GroupType;

        if (groupIndex.kind === '2d') {
          for (i = 0, nLen = added.length; i < nLen; ++i) {
            if (filters.zeroExcept(kIdx = added[i], offset, zero)) {
              for (j = 0; j < groupIndex.data[kIdx].length; j++) {
                g = groups[groupIndex.data[kIdx][j]];
                g.value = reduceAdd(g.value, data[kIdx], false, j);
              }
            }
          }

          for (i = 0, nLen = removed.length; i < nLen; ++i) {
            if (filters.onlyExcept(kIdx = removed[i], offset, zero, filterOffset, filterOne)) {
              for (j = 0; j < groupIndex.data[kIdx].length; j++) {
                g = groups[groupIndex.data[kIdx][j]];
                g.value = reduceRemove(g.value, data[kIdx], notFilterValue, j);
              }
            }
          }
          return;
        }

        for (i = 0, nLen = added.length; i < nLen; ++i) {
          if (filters.zeroExcept(kIdx = added[i], offset, zero)) {
            g = groups[groupIndex.data[kIdx]];
            g.value = reduceAdd(g.value, data[kIdx], false);
          }
        }

        for (i = 0, nLen = removed.length; i < nLen; ++i) {
          if (filters.onlyExcept(kIdx = removed[i], offset, zero, filterOffset, filterOne)) {
            g = groups[groupIndex.data[kIdx]];
            g.value = reduceRemove(g.value, data[kIdx], notFilterValue);
          }
        }
      }

      function updateOne(filterOne: number, filterOffset: number, added: number[], removed: number[], notFilter?: boolean): void {
        if ((filterOne === one && filterOffset === offset) || resetNeeded) return;

        const notFilterValue = notFilter === true;
        let i: number;
        let kIdx: number;
        let nLen: number;
        const g = groups[0];

        for (i = 0, nLen = added.length; i < nLen; ++i) {
          if (filters.zeroExcept(kIdx = added[i], offset, zero)) {
            g.value = reduceAdd(g.value, data[kIdx], false);
          }
        }

        for (i = 0, nLen = removed.length; i < nLen; ++i) {
          if (filters.onlyExcept(kIdx = removed[i], offset, zero, filterOffset, filterOne)) {
            g.value = reduceRemove(g.value, data[kIdx], notFilterValue);
          }
        }
      }

      function resetMany(): void {
        let i: number;
        let j: number;
        let g: GroupType;

        for (i = 0; i < kVal; ++i) {
          groups[i].value = reduceInitial();
        }

        if (groupIndex.kind === '2d') {
          for (i = 0; i < n; ++i) {
            for (j = 0; j < groupIndex.data[i].length; j++) {
              g = groups[groupIndex.data[i][j]];
              g.value = reduceAdd(g.value, data[i], true, j);
            }
          }
          for (i = 0; i < n; ++i) {
            if (!filters.zeroExcept(i, offset, zero)) {
              for (j = 0; j < groupIndex.data[i].length; j++) {
                g = groups[groupIndex.data[i][j]];
                g.value = reduceRemove(g.value, data[i], false, j);
              }
            }
          }
          return;
        }

        for (i = 0; i < n; ++i) {
          g = groups[groupIndex.data[i]];
          g.value = reduceAdd(g.value, data[i], true);
        }
        for (i = 0; i < n; ++i) {
          if (!filters.zeroExcept(i, offset, zero)) {
            g = groups[groupIndex.data[i]];
            g.value = reduceRemove(g.value, data[i], false);
          }
        }
      }

      function resetOne(): void {
        let i: number;
        const g = groups[0];

        g.value = reduceInitial();

        for (i = 0; i < n; ++i) {
          g.value = reduceAdd(g.value, data[i], true);
        }

        for (i = 0; i < n; ++i) {
          if (!filters.zeroExcept(i, offset, zero)) {
            g.value = reduceRemove(g.value, data[i], false);
          }
        }
      }

      function groupAll(): GroupType[] {
        if (resetNeeded) {
          reset();
          resetNeeded = false;
        }
        return groups;
      }

      function groupTop(k: number): GroupType[] {
        const top = select(groupAll(), 0, groups.length, k);
        return heap.sort(top, 0, top.length);
      }

      function reduce(
        add: ReducerAdd<T, number>,
        remove: ReducerRemove<T, number>,
        initial: ReducerInitial<number>
      ): DimensionGroup<T, K, number> {
        reduceAdd = add;
        reduceRemove = remove;
        reduceInitial = initial;
        resetNeeded = true;
        return grp;
      }

      function reduceCount(): DimensionGroup<T, K, number> {
        return reduce(
          xfilterReduce.reduceIncrement,
          xfilterReduce.reduceDecrement,
          cr_zero
        );
      }

      function reduceSum(value: (record: T) => number): DimensionGroup<T, K, number> {
        return reduce(
          xfilterReduce.reduceAdd(value),
          xfilterReduce.reduceSubtract(value),
          cr_zero
        );
      }

      function order(value: OrderValue<number>): DimensionGroup<T, K, number> {
        select = xfilterHeapselect.by(valueOf);
        heap = xfilterHeap.by(valueOf);
        function valueOf(d: GroupType): number { return value(d.value); }
        return grp;
      }

      function orderNatural(): DimensionGroup<T, K, number> {
        return order(cr_identity);
      }

      function groupSize(): number {
        return kVal;
      }

      function groupDispose(): DimensionGroup<T, K, number> {
        let i = filterListeners.indexOf(update);
        if (i >= 0) filterListeners.splice(i, 1);
        i = indexListeners.indexOf(addToGroup);
        if (i >= 0) indexListeners.splice(i, 1);
        i = removeDataListeners.indexOf(removeGroupData);
        if (i >= 0) removeDataListeners.splice(i, 1);
        i = dimensionGroups.indexOf(grp);
        if (i >= 0) dimensionGroups.splice(i, 1);
        return grp;
      }

      return reduceCount().orderNatural();
    }

    function dimGroupAll(): DimensionGroupAll<T, number> {
      const nullKey = (_value: V): null => null;
      const base = createGroup(nullKey, true, null);
      const groupAll: DimensionGroupAll<T, number> = {
        reduce: function(add, remove, initial) {
          base.reduce(add, remove, initial);
          return groupAll;
        },
        reduceCount: function() {
          base.reduceCount();
          return groupAll;
        },
        reduceSum: function(value) {
          base.reduceSum(value);
          return groupAll;
        },
        value: function(): number {
          const all = base.all();
          return all.length ? all[0].value : 0;
        },
        dispose: function() {
          base.dispose();
          return groupAll;
        },
        remove: function() {
          base.remove();
          return groupAll;
        }
      };
      return groupAll;
    }

    function dispose(): Dimension<T, V> {
      dimensionGroups.forEach(function(group) { group.dispose(); });
      let i = dataListeners.indexOf(preAdd);
      if (i >= 0) dataListeners.splice(i, 1);
      i = dataListeners.indexOf(postAdd);
      if (i >= 0) dataListeners.splice(i, 1);
      i = removeDataListeners.indexOf(removeData);
      if (i >= 0) removeDataListeners.splice(i, 1);
      filters.masks[offset] &= zero;
      return filterAll();
    }

    return dim;
  }

  function groupAll(): CrossfilterGroupAll<T, number> {
    const grp: CrossfilterGroupAll<T, number> = {
      reduce: reduce,
      reduceCount: reduceCount,
      reduceSum: reduceSum,
      value: value,
      dispose: dispose,
      remove: dispose
    };

    let reduceValue = 0;
    let reduceAdd: ReducerAdd<T, number> = xfilterReduce.reduceIncrement;
    let reduceRemove: ReducerRemove<T, number> = xfilterReduce.reduceDecrement;
    let reduceInitial: ReducerInitial<number> = cr_zero;
    let resetNeeded = true;

    filterListeners.push(update);
    dataListeners.push(add);

    add(data, 0, n);

    function add(newData: T[], n0: number, _n1: number): void {
      let i: number;

      if (resetNeeded) return;

      for (i = n0; i < n; ++i) {
        reduceValue = reduceAdd(reduceValue, data[i], true);
        if (!filters.zero(i)) {
          reduceValue = reduceRemove(reduceValue, data[i], false);
        }
      }
    }

    function update(filterOne: number, filterOffset: number, added: number[], removed: number[], notFilter?: boolean): void {
      const notFilterValue = notFilter === true;
      let i: number;
      let kIdx: number;
      let nLen: number;

      if (resetNeeded) return;

      for (i = 0, nLen = added.length; i < nLen; ++i) {
        if (filters.zero(kIdx = added[i])) {
          reduceValue = reduceAdd(reduceValue, data[kIdx], notFilterValue);
        }
      }

      for (i = 0, nLen = removed.length; i < nLen; ++i) {
        if (filters.only(kIdx = removed[i], filterOffset, filterOne)) {
          reduceValue = reduceRemove(reduceValue, data[kIdx], notFilterValue);
        }
      }
    }

    function reset(): void {
      let i: number;

      reduceValue = reduceInitial();

      for (i = 0; i < n; ++i) {
        reduceValue = reduceAdd(reduceValue, data[i], true);
        if (!filters.zero(i)) {
          reduceValue = reduceRemove(reduceValue, data[i], false);
        }
      }
    }

    function reduce(
      add: ReducerAdd<T, number>,
      remove: ReducerRemove<T, number>,
      initial: ReducerInitial<number>
    ): CrossfilterGroupAll<T, number> {
      reduceAdd = add;
      reduceRemove = remove;
      reduceInitial = initial;
      resetNeeded = true;
      return grp;
    }

    function reduceCount(): CrossfilterGroupAll<T, number> {
      return reduce(
        xfilterReduce.reduceIncrement,
        xfilterReduce.reduceDecrement,
        cr_zero
      );
    }

    function reduceSum(value: (record: T) => number): CrossfilterGroupAll<T, number> {
      return reduce(
        xfilterReduce.reduceAdd(value),
        xfilterReduce.reduceSubtract(value),
        cr_zero
      );
    }

    function value(): number {
      if (resetNeeded) {
        reset();
        resetNeeded = false;
      }
      return reduceValue;
    }

    function dispose(): CrossfilterGroupAll<T, number> {
      let i = filterListeners.indexOf(update);
      if (i >= 0) filterListeners.splice(i, 1);
      i = dataListeners.indexOf(add);
      if (i >= 0) dataListeners.splice(i, 1);
      return grp;
    }

    return reduceCount();
  }

  function size(): number {
    return n;
  }

  function all(): T[] {
    return data;
  }

  function allFiltered(ignore_dimensions?: Array<{ id: () => number }>): T[] {
    const array: T[] = [];
    const mask = maskForDimensions(ignore_dimensions || []);

    for (let i = 0; i < n; i++) {
      if (filters.zeroExceptMask(i, mask)) {
        array.push(data[i]);
      }
    }

    return array;
  }

  function onChange(cb: (eventName: string) => void): () => void {
    if (typeof cb !== 'function') {
      console.warn('onChange callback parameter must be a function!');
      return () => {};
    }
    callbacks.push(cb);
    return function() {
      callbacks.splice(callbacks.indexOf(cb), 1);
    };
  }

  function triggerOnChange(eventName: string): void {
    for (let i = 0; i < callbacks.length; i++) {
      callbacks[i](eventName);
    }
  }

  return initialData !== undefined ? add(initialData) : cf;
};

crossfilter.heap = xfilterHeap;
crossfilter.heapselect = xfilterHeapselect;
crossfilter.bisect = bisect;
crossfilter.permute = permute;

export default crossfilter;

// Helper functions
function cr_index(n: number, m: number): number[] | Uint8Array | Uint16Array | Uint32Array {
  return (m < 0x101
    ? xfilterArray.array8 : m < 0x10001
      ? xfilterArray.array16
      : xfilterArray.array32)(n);
}

function cr_range(n: number): number[] | Uint8Array | Uint16Array | Uint32Array {
  const range = cr_index(n, n);
  for (let i = -1; ++i < n;) range[i] = i;
  return range;
}

function capacity(w: number): number {
  return w === 8
    ? 0x100 : w === 16
      ? 0x10000
      : 0x100000000;
}

// Lengthen a 1D GroupIndex
function lengthenGroupIndex(gi: GroupIndex, n: number): GroupIndex {
  if (gi.kind === '1d') {
    return { kind: '1d', data: xfilterArray.arrayLengthen(gi.data, n) };
  }
  // 2D array - return unchanged
  return gi;
}

// Widen a 1D GroupIndex
function widenGroupIndex(gi: GroupIndex, width: number): GroupIndex {
  if (gi.kind === '1d') {
    return { kind: '1d', data: xfilterArray.arrayWiden(gi.data, width) };
  }
  // 2D array - return unchanged
  return gi;
}
