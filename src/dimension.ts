import xfilterArray from "./array.js";
import xfilterFilter from "./filter.js";
import cr_identity from "./identity.js";
import bisect from "./bisect.js";
import permute from "./permute.js";
import createGroup, { createDimensionGroupAll } from "./group.js";
import type { Group } from "./group.js";
import type { GroupAll } from "./groupAll.js";
import type { CrossfilterState, DimensionGroupState, IndexListener } from "./state.js";
import { indexArray, indexRange, REMOVED_INDEX } from "./indexes.js";

export type DimensionAccessor<T, V, A> =
  | { iterable: false; value: (record: T) => V; accessor: (record: T) => A }
  | { iterable: true; value: (record: T) => ArrayLike<V>; accessor: (record: T) => A };

export type FilterPredicate<V> = (value: V, index: number) => boolean;
export type FilterValue<V> = V | null | [V, V] | FilterPredicate<V>;

export interface Dimension<T, V, A = V> {
  accessor(record: T): A;
  filter(value?: FilterValue<V> | null): Dimension<T, V, A>;
  filterExact(value: V | null | undefined): Dimension<T, V, A>;
  filterRange(range: [V, V]): Dimension<T, V, A>;
  filterFunction(predicate: FilterPredicate<V>): Dimension<T, V, A>;
  filterAll(): Dimension<T, V, A>;
  currentFilter(): FilterValue<V> | undefined;
  hasCurrentFilter(): boolean | undefined;
  top(k: number, offset?: number): T[];
  bottom(k: number, offset?: number): T[];
  group<K>(key: (value: V) => K): Group<T, K, number>;
  group(): Group<T, V, number>;
  groupAll(): GroupAll<T, number>;
  dispose(): Dimension<T, V, A>;
  remove(): Dimension<T, V, A>;
  id(): number;
}

export default function createDimension<T, V, A>(
  context: CrossfilterState<T>,
  accessor: DimensionAccessor<T, V, A>,
): Dimension<T, V, A> {
  const { iterable } = accessor;

  const dimension: Dimension<T, V, A> = {
    accessor: accessor.accessor,
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
    groupAll: groupAll,
    dispose: dispose,
    remove: dispose,
    id: function () {
      return id;
    },
  };

  let values: V[] = [];
  let index: number[] = [];
  let newValues: V[] = [];
  let newIndex: number[] = [];
  let iterablesIndexCount: number[] = [];
  let iterablesIndexFilterStatus: number[] = [];
  const iterablesEmptyRows: number[] = [];
  const sortRange = (n: number) =>
    indexRange(n).sort((A, B) => {
      const a = newValues[A];
      const b = newValues[B];
      return a < b ? -1 : a > b ? 1 : A - B;
    });
  let refilter: (values: readonly V[]) => [number, number] = xfilterFilter.filterAll;
  let refilterFunction: FilterPredicate<V> | undefined;
  let filterValue: FilterValue<V> | undefined;
  let filterValuePresent: boolean | undefined;
  const indexListeners: IndexListener<V>[] = [];
  const dimensionGroups: { dispose(): unknown }[] = [];
  let lo0 = 0;
  let hi0 = 0;
  let t = 0;

  context.dataListeners.unshift(preAdd);
  context.dataListeners.push(postAdd);

  context.removeDataListeners.push(removeData);

  const { offset, one } = context.filters.add();
  const zero = ~one;
  const id = (offset << 7) | (Math.log(one) / Math.log(2));

  const groupState: DimensionGroupState<V> = {
    values,
    index,
    iterable,
    offset,
    one,
    zero,
    indexListeners,
    dimensionGroups,
  };

  preAdd(context.data, 0, context.n);
  postAdd(context.data, 0, context.n);

  function preAdd(newData: readonly T[], n0: number, n1: number) {
    let newIterablesIndexCount: number[] = [];
    let newIterablesIndexFilterStatus: number[] = [];
    let k: ArrayLike<V> = [];
    let j = 0;
    let i0 = 0;

    if (iterable) {
      t = 0;
      j = 0;
      k = [];

      for (i0 = 0; i0 < newData.length; i0++) {
        for (j = 0, k = accessor.value(newData[i0]); j < k.length; j++) {
          t++;
        }
      }

      newValues = [];
      newIterablesIndexCount = indexRange(newData.length);
      newIterablesIndexFilterStatus = indexArray(t, 1);
      const unsortedIndex = indexRange(t);

      for (let l = 0, index1 = 0; index1 < newData.length; index1++) {
        k = accessor.value(newData[index1]);

        if (!k.length) {
          newIterablesIndexCount[index1] = 0;
          iterablesEmptyRows.push(index1 + n0);
          continue;
        }
        newIterablesIndexCount[index1] = k.length;
        for (j = 0; j < k.length; j++) {
          newValues.push(k[j]);
          unsortedIndex[l] = index1;
          l++;
        }
      }

      const sortMap = sortRange(t);

      newValues = permute(newValues, sortMap);

      newIndex = permute(unsortedIndex, sortMap);
    } else {
      newValues = newData.map(accessor.value);
      newIndex = sortRange(n1);
      newValues = permute(newValues, newIndex);
    }

    let bounds = refilter(newValues);
    const lo1 = bounds[0];
    const hi1 = bounds[1];

    let index2, index3, index4;
    if (iterable) {
      n1 = t;
      if (refilterFunction) {
        for (index2 = 0; index2 < n1; ++index2) {
          if (!refilterFunction(newValues[index2], index2)) {
            if (--newIterablesIndexCount[newIndex[index2]] === 0) {
              context.filters[offset][newIndex[index2] + n0] |= one;
            }
            newIterablesIndexFilterStatus[index2] = 1;
          }
        }
      } else {
        for (index3 = 0; index3 < lo1; ++index3) {
          if (--newIterablesIndexCount[newIndex[index3]] === 0) {
            context.filters[offset][newIndex[index3] + n0] |= one;
          }
          newIterablesIndexFilterStatus[index3] = 1;
        }
        for (index4 = hi1; index4 < n1; ++index4) {
          if (--newIterablesIndexCount[newIndex[index4]] === 0) {
            context.filters[offset][newIndex[index4] + n0] |= one;
          }
          newIterablesIndexFilterStatus[index4] = 1;
        }
      }
    } else {
      if (refilterFunction) {
        for (index2 = 0; index2 < n1; ++index2) {
          if (!refilterFunction(newValues[index2], index2)) {
            context.filters[offset][newIndex[index2] + n0] |= one;
          }
        }
      } else {
        for (index3 = 0; index3 < lo1; ++index3) {
          context.filters[offset][newIndex[index3] + n0] |= one;
        }
        for (index4 = hi1; index4 < n1; ++index4) {
          context.filters[offset][newIndex[index4] + n0] |= one;
        }
      }
    }

    if (!n0) {
      values = newValues;
      index = newIndex;
      iterablesIndexCount = newIterablesIndexCount;
      iterablesIndexFilterStatus = newIterablesIndexFilterStatus;
      lo0 = lo1;
      hi0 = hi1;
      return;
    }

    const oldValues = values;
    const oldIndex = index;
    const oldIterablesIndexFilterStatus = iterablesIndexFilterStatus;
    let old_n0 = n0;
    let i1 = 0;

    i0 = 0;

    if (iterable) {
      old_n0 = n0;
      n0 = oldValues.length;
      n1 = t;
    }

    values = iterable ? new Array<V>(n0 + n1) : new Array<V>(context.n);
    index = iterable ? new Array<number>(n0 + n1) : indexArray(context.n, context.n);
    if (iterable) iterablesIndexFilterStatus = indexArray(n0 + n1, 1);

    if (iterable) {
      const oldiiclength = iterablesIndexCount.length;
      iterablesIndexCount = xfilterArray.arrayLengthen(iterablesIndexCount, context.n);
      for (j = 0; j + oldiiclength < context.n; j++) {
        iterablesIndexCount[j + oldiiclength] = newIterablesIndexCount[j];
      }
    }

    let index5 = 0;
    for (; i0 < n0 && i1 < n1; ++index5) {
      if (oldValues[i0] < newValues[i1]) {
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

    bounds = refilter(values);
    lo0 = bounds[0];
    hi0 = bounds[1];
  }

  function postAdd(newData: readonly T[], n0: number, n1: number) {
    groupState.values = values;
    groupState.index = index;
    indexListeners.forEach(function (l) {
      l(newValues, newIndex, n0, n1);
    });
    newValues = [];
    newIndex = [];
  }

  function removeData(reIndex: number[]) {
    if (iterable) {
      let i0 = 0;
      let i1 = 0;
      for (; i0 < iterablesEmptyRows.length; i0++) {
        if (reIndex[iterablesEmptyRows[i0]] !== REMOVED_INDEX) {
          iterablesEmptyRows[i1] = reIndex[iterablesEmptyRows[i0]];
          i1++;
        }
      }
      iterablesEmptyRows.length = i1;
      for (i0 = 0, i1 = 0; i0 < context.n; i0++) {
        if (reIndex[i0] !== REMOVED_INDEX) {
          if (i1 !== i0) iterablesIndexCount[i1] = iterablesIndexCount[i0];
          i1++;
        }
      }
      iterablesIndexCount = iterablesIndexCount.slice(0, i1);
    }

    const n0 = values.length;
    let j = 0;
    for (let i = 0; i < n0; ++i) {
      const oldDataIndex = index[i];
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

  function filterIndexBounds(bounds: [number, number]) {
    const lo1 = bounds[0];
    const hi1 = bounds[1];

    if (refilterFunction) {
      refilterFunction = undefined;
      filterIndexFunction(
        function (d, i) {
          return lo1 <= i && i < hi1;
        },
        bounds[0] === 0 && bounds[1] === values.length,
      );
      lo0 = lo1;
      hi0 = hi1;
      return dimension;
    }

    let i, j, k;
    let added: number[] = [];
    let removed: number[] = [];
    const valueIndexAdded = [];
    const valueIndexRemoved = [];

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

    if (!iterable) {
      for (i = 0; i < added.length; i++) {
        context.filters[offset][added[i]] ^= one;
      }

      for (i = 0; i < removed.length; i++) {
        context.filters[offset][removed[i]] ^= one;
      }
    } else {
      const newAdded = [];
      const newRemoved = [];
      for (i = 0; i < added.length; i++) {
        iterablesIndexCount[added[i]]++;
        iterablesIndexFilterStatus[valueIndexAdded[i]] = 0;
        if (iterablesIndexCount[added[i]] === 1) {
          context.filters[offset][added[i]] ^= one;
          newAdded.push(added[i]);
        }
      }
      for (i = 0; i < removed.length; i++) {
        iterablesIndexCount[removed[i]]--;
        iterablesIndexFilterStatus[valueIndexRemoved[i]] = 1;
        if (iterablesIndexCount[removed[i]] === 0) {
          context.filters[offset][removed[i]] ^= one;
          newRemoved.push(removed[i]);
        }
      }

      added = newAdded;
      removed = newRemoved;

      if (refilter === xfilterFilter.filterAll) {
        for (i = 0; i < iterablesEmptyRows.length; i++) {
          if (context.filters[offset][(k = iterablesEmptyRows[i])] & one) {
            context.filters[offset][k] ^= one;
            added.push(k);
          }
        }
      } else {
        for (i = 0; i < iterablesEmptyRows.length; i++) {
          if (!(context.filters[offset][(k = iterablesEmptyRows[i])] & one)) {
            context.filters[offset][k] ^= one;
            removed.push(k);
          }
        }
      }
    }

    lo0 = lo1;
    hi0 = hi1;
    context.filterListeners.forEach(function (l) {
      l(one, offset, added, removed);
    });
    context.triggerOnChange("filtered");
    return dimension;
  }

  function filter(range: FilterValue<V> | null | undefined): Dimension<T, V, A> {
    if (range == null) return filterAll();
    if (isFilterRange(range)) return filterRange(range);
    if (isFilterPredicate(range)) return filterFunction(range);
    return filterExact(range);
  }

  function filterExact(value: V | null | undefined): Dimension<T, V, A> {
    filterValue = value;
    filterValuePresent = true;
    return filterIndexBounds((refilter = xfilterFilter.filterExact(bisect, value))(values));
  }

  function filterRange(range: [V, V]): Dimension<T, V, A> {
    filterValue = range;
    filterValuePresent = true;
    return filterIndexBounds((refilter = xfilterFilter.filterRange(bisect, range))(values));
  }

  function filterAll(): Dimension<T, V, A> {
    filterValue = undefined;
    filterValuePresent = false;
    return filterIndexBounds((refilter = xfilterFilter.filterAll)(values));
  }

  function filterFunction(f: FilterPredicate<V>): Dimension<T, V, A> {
    filterValue = f;
    filterValuePresent = true;

    refilterFunction = f;
    refilter = xfilterFilter.filterAll;

    filterIndexFunction(f, false);

    const bounds = refilter(values);
    lo0 = bounds[0];
    hi0 = bounds[1];

    return dimension;
  }

  function filterIndexFunction(f: FilterPredicate<V>, filterAll: boolean) {
    let i, k, x;
    let added: number[] = [];
    let removed: number[] = [];
    const valueIndexAdded = [];
    const valueIndexRemoved = [];
    const indexLength = values.length;

    if (!iterable) {
      for (i = 0; i < indexLength; ++i) {
        if (!(context.filters[offset][(k = index[i])] & one) !== !!(x = f(values[i], i))) {
          if (x) added.push(k);
          else removed.push(k);
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
        if (context.filters[offset][added[i]] & one) context.filters[offset][added[i]] &= zero;
      }

      for (i = 0; i < removed.length; i++) {
        if (!(context.filters[offset][removed[i]] & one))
          context.filters[offset][removed[i]] |= one;
      }
    } else {
      const newAdded = [];
      const newRemoved = [];
      for (i = 0; i < added.length; i++) {
        if (iterablesIndexFilterStatus[valueIndexAdded[i]] === 1) {
          iterablesIndexCount[added[i]]++;
          iterablesIndexFilterStatus[valueIndexAdded[i]] = 0;
          if (iterablesIndexCount[added[i]] === 1) {
            context.filters[offset][added[i]] ^= one;
            newAdded.push(added[i]);
          }
        }
      }
      for (i = 0; i < removed.length; i++) {
        if (iterablesIndexFilterStatus[valueIndexRemoved[i]] === 0) {
          iterablesIndexCount[removed[i]]--;
          iterablesIndexFilterStatus[valueIndexRemoved[i]] = 1;
          if (iterablesIndexCount[removed[i]] === 0) {
            context.filters[offset][removed[i]] ^= one;
            newRemoved.push(removed[i]);
          }
        }
      }

      added = newAdded;
      removed = newRemoved;

      if (filterAll) {
        for (i = 0; i < iterablesEmptyRows.length; i++) {
          if (context.filters[offset][(k = iterablesEmptyRows[i])] & one) {
            context.filters[offset][k] ^= one;
            added.push(k);
          }
        }
      } else {
        for (i = 0; i < iterablesEmptyRows.length; i++) {
          if (!(context.filters[offset][(k = iterablesEmptyRows[i])] & one)) {
            context.filters[offset][k] ^= one;
            removed.push(k);
          }
        }
      }
    }

    context.filterListeners.forEach(function (l) {
      l(one, offset, added, removed);
    });
    context.triggerOnChange("filtered");
  }

  function currentFilter() {
    return filterValue;
  }

  function hasCurrentFilter() {
    return filterValuePresent;
  }

  function top(k: number, top_offset?: number) {
    const array: T[] = [];
    let i = hi0;
    let j;
    let toSkip = 0;

    if (top_offset && top_offset > 0) toSkip = top_offset;

    while (--i >= lo0 && k > 0) {
      if (context.filters.zero((j = index[i]))) {
        if (toSkip > 0) {
          --toSkip;
        } else {
          array.push(context.data[j]);
          --k;
        }
      }
    }

    if (iterable) {
      for (i = 0; i < iterablesEmptyRows.length && k > 0; i++) {
        if (context.filters.zero((j = iterablesEmptyRows[i]))) {
          if (toSkip > 0) {
            --toSkip;
          } else {
            array.push(context.data[j]);
            --k;
          }
        }
      }
    }

    return array;
  }

  function bottom(k: number, bottom_offset?: number) {
    const array: T[] = [];
    let i;
    let j;
    let toSkip = 0;

    if (bottom_offset && bottom_offset > 0) toSkip = bottom_offset;

    if (iterable) {
      for (i = 0; i < iterablesEmptyRows.length && k > 0; i++) {
        if (context.filters.zero((j = iterablesEmptyRows[i]))) {
          if (toSkip > 0) {
            --toSkip;
          } else {
            array.push(context.data[j]);
            --k;
          }
        }
      }
    }

    i = lo0;

    while (i < hi0 && k > 0) {
      if (context.filters.zero((j = index[i]))) {
        if (toSkip > 0) {
          --toSkip;
        } else {
          array.push(context.data[j]);
          --k;
        }
      }
      i++;
    }

    return array;
  }

  function group<K>(key: (value: V) => K): Group<T, K, number>;
  function group(): Group<T, V, number>;
  function group<K>(key?: (value: V) => K) {
    return key
      ? createGroup(context, groupState, key)
      : createGroup(context, groupState, cr_identity<V>);
  }

  function groupAll() {
    return createDimensionGroupAll(context, groupState);
  }

  function dispose() {
    dimensionGroups.forEach(function (group) {
      group.dispose();
    });
    let i = context.dataListeners.indexOf(preAdd);
    if (i >= 0) context.dataListeners.splice(i, 1);
    i = context.dataListeners.indexOf(postAdd);
    if (i >= 0) context.dataListeners.splice(i, 1);
    i = context.removeDataListeners.indexOf(removeData);
    if (i >= 0) context.removeDataListeners.splice(i, 1);
    context.filters.masks[offset] &= zero;
    return filterAll();
  }

  return dimension;
}

function isFilterRange<V>(value: FilterValue<V>): value is [V, V] {
  return Array.isArray(value);
}

function isFilterPredicate<V>(value: FilterValue<V>): value is FilterPredicate<V> {
  return typeof value === "function";
}
