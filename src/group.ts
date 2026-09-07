import arrays from "./array.js";
import bisect from "./bisect.js";
import heapBy from "./heap.js";
import heapselectBy from "./heapselect.js";
import { capacity, indexArray, REMOVED_INDEX } from "./indexes.js";
import initialZero from "./zero.js";
import type { GroupAll, Reducer } from "./groupAll.js";
import type { NaturallyOrderedValue } from "./order.js";
import type {
  CrossfilterState,
  DimensionGroupState,
  FilterListener,
  IndexListener,
  RemoveListener,
} from "./state.js";

export interface Grouping<Key, Value> {
  key: Key;
  value: Value;
}

export interface Group<Record, Key, Value> {
  all(): Grouping<Key, Value>[];
  top(k: number): Grouping<Key, Value>[];
  reduce<NextValue>(
    add: Reducer<Record, NextValue>,
    remove: Reducer<Record, NextValue>,
    initial: () => NextValue,
  ): Group<Record, Key, NextValue>;
  reduceCount(): Group<Record, Key, number>;
  reduceSum(value: (record: Record) => number): Group<Record, Key, number>;
  order(value: (value: Value) => NaturallyOrderedValue): Group<Record, Key, Value>;
  orderNatural(): Group<Record, Key, Value>;
  size(): number;
  dispose(): Group<Record, Key, Value>;
  remove(): Group<Record, Key, Value>;
}

type NumericArray = ReturnType<typeof indexArray>;

interface Ordering<Key> {
  top(k: number): { key: Key }[];
}

function createGroupMethods<Record, Key, Value>(
  view: Pick<Group<Record, Key, Value>, "all" | "top" | "order" | "orderNatural" | "dispose">,
) {
  const dispose = () => view.dispose();
  return {
    all: () => view.all(),
    top: (count: number) => view.top(count),
    order: (value: (value: Value) => NaturallyOrderedValue) => view.order(value),
    orderNatural: () => view.orderNatural(),
    dispose,
    remove: dispose,
  };
}

function createOrdering<Key, Value>(
  view: { all(): Grouping<Key, Value>[] },
  value: (value: Value) => NaturallyOrderedValue,
) {
  const valueOf = (entry: Grouping<Key, Value>) => value(entry.value);
  const select = heapselectBy.by(valueOf);
  const heap = heapBy.by(valueOf);
  return {
    select,
    heap,
    top(count: number) {
      const groups = view.all();
      const selected = select(groups, 0, groups.length, count);
      return heap.sort(selected, 0, selected.length);
    },
  };
}

function initializeGroups<Key, Value>(
  groups: Grouping<Key, unknown>[],
  initial: () => Value,
): groups is Grouping<Key, Value>[] {
  for (let i = 0; i < groups.length; ++i) {
    const entry = groups[i];
    const value = initial();
    entry.value = value;
    if (!Object.is(entry.value, value)) return false;
  }
  return true;
}

export default function createGroup<Record, DimensionValue, Key>(
  state: CrossfilterState<Record>,
  dimension: DimensionGroupState<DimensionValue>,
  key: (value: DimensionValue) => Key,
): Group<Record, Key, number> {
  return createGrouping(state, dimension, key);
}

function createGrouping<Record, DimensionValue, Key>(
  state: CrossfilterState<Record>,
  dimension: DimensionGroupState<DimensionValue>,
  key: (value: DimensionValue) => Key,
  singleton?: { key: Key },
): Group<Record, Key, number> {
  const group = {};
  const view = {};
  const { iterable, offset, one, zero } = dimension;
  let entries: Grouping<Key, unknown>[] = [];
  let groupIndex: NumericArray = arrays.array8(0);
  let iterableGroupIndex: number[][] = [];
  let groupWidth = 8;
  let groupCapacity = capacity(groupWidth);
  let k = 0;
  let ordering: Ordering<Key> | undefined;
  let update: FilterListener = () => {};
  let add: IndexListener<DimensionValue> = () => {};
  let remove: RemoveListener = () => {};
  state.filterListeners.push(update);
  dimension.indexListeners.push(add);
  state.removeDataListeners.push(remove);

  function configure<Value>(
    reduceAdd: Reducer<Record, Value>,
    reduceRemove: Reducer<Record, Value>,
    reduceInitial: () => Value,
  ): Group<Record, Key, Value> {
    let groups: Grouping<Key, Value>[] = [];
    let resetNeeded = true;
    let retainedOrdering = ordering;
    let groupLookup: Map<{ key: Key }, Grouping<Key, Value>> | undefined;
    const groupBisect = bisect.by((entry: Grouping<Key, Value>) => entry.key);
    let select = heapselectBy.by((entry: Grouping<Key, Value>) => entry.value);
    let heap = heapBy.by((entry: Grouping<Key, Value>) => entry.value);

    function setUpdate() {
      const next = k > 1 || iterable ? updateMany : k === 1 ? updateOne : updateNone;
      const index = state.filterListeners.indexOf(update);
      if (index >= 0) state.filterListeners[index] = next;
      update = next;
    }

    function updateNone() {}

    function addData(newValues: DimensionValue[], newIndex: number[], n0: number, n1: number) {
      const { data, filters, n } = state;
      groupLookup = undefined;
      const recordOffset = n0;
      if (iterable) {
        n0 = dimension.values.length - newValues.length;
        n1 = newValues.length;
      }
      const oldEntries = entries;
      const oldGroups = groups;
      let reIndex = iterable ? arrays.array32(k) : indexArray(k, groupCapacity);
      const k0 = k;
      let i0 = 0;
      let i1 = 0;
      const nextGroups: Grouping<Key, Value>[] = [];
      entries = resetNeeded ? new Array<Grouping<Key, unknown>>(k) : nextGroups;
      groups = nextGroups;
      k = 0;
      if (iterable) {
        if (!k0) iterableGroupIndex = [];
      } else {
        groupIndex = k0 > 1 ? arrays.arrayLengthen(groupIndex, n) : indexArray(n, groupCapacity);
      }
      let oldEntry = oldEntries[i0];
      if (n1) {
        let nextKey = key(newValues[i1]);
        while (!(nextKey >= nextKey) && ++i1 < n1) nextKey = key(newValues[i1]);
        while (i1 < n1) {
          let entry: Grouping<Key, unknown>;
          if (oldEntry && oldEntry.key <= nextKey) {
            entry = oldEntry;
            if (!resetNeeded) groups[k] = oldGroups[i0];
            reIndex[i0] = k;
            oldEntry = oldEntries[++i0];
          } else if (resetNeeded) {
            entry = { key: nextKey, value: null };
          } else {
            entry = groups[k] = { key: nextKey, value: reduceInitial() };
          }
          if (resetNeeded) entries[k] = entry;
          while (nextKey <= entry.key) {
            const recordIndex = newIndex[i1] + (iterable ? recordOffset : n0);
            if (iterable) {
              const recordGroups = iterableGroupIndex[recordIndex];
              if (recordGroups) recordGroups.push(k);
              else iterableGroupIndex[recordIndex] = [k];
            } else {
              groupIndex[recordIndex] = k;
            }
            if (!resetNeeded) {
              const current = groups[k];
              current.value = reduceAdd(current.value, data[recordIndex], true);
              if (!filters.zeroExcept(recordIndex, offset, zero))
                current.value = reduceRemove(current.value, data[recordIndex], false);
            }
            if (++i1 >= n1) break;
            nextKey = key(newValues[i1]);
          }
          increment();
        }
      }
      while (i0 < k0) {
        reIndex[i0] = k;
        if (resetNeeded) entries[k] = oldEntries[i0];
        else groups[k] = oldGroups[i0];
        ++i0;
        increment();
      }
      if (iterable) {
        for (let i = 0; i < n; ++i) {
          if (!iterableGroupIndex[i]) iterableGroupIndex[i] = [];
        }
      }
      if (k > i0) {
        if (iterable) {
          for (i0 = 0; i0 < recordOffset; ++i0) {
            const recordGroups = iterableGroupIndex[i0];
            for (let j = 0; j < recordGroups.length; ++j)
              recordGroups[j] = reIndex[recordGroups[j]];
          }
        } else {
          for (i0 = 0; i0 < n0; ++i0) groupIndex[i0] = reIndex[groupIndex[i0]];
        }
      }
      if (k <= 1 && !iterable) {
        if (!k && singleton) {
          k = 1;
          if (resetNeeded) entries = [{ key: singleton.key, value: null }];
          else entries = groups = [{ key: singleton.key, value: reduceInitial() }];
        }
        groupIndex = arrays.array8(0);
      }
      setUpdate();

      function increment() {
        if (iterable) {
          ++k;
        } else if (++k === groupCapacity) {
          reIndex = arrays.arrayWiden(reIndex, (groupWidth <<= 1));
          groupIndex = arrays.arrayWiden(groupIndex, groupWidth);
          groupCapacity = capacity(groupWidth);
        }
      }
    }

    function removeData(reIndex: number[]) {
      const { n } = state;
      groupLookup = undefined;
      if (k > 1 || iterable) {
        const oldK = k;
        const oldEntries = entries;
        const oldGroups = groups;
        const seenGroups = indexArray(oldK, oldK);
        let remaining = 0;
        if (iterable) {
          for (let i = 0; i < n; ++i) {
            if (reIndex[i] !== REMOVED_INDEX) {
              const recordGroups = (iterableGroupIndex[remaining++] = iterableGroupIndex[i]);
              for (let j = 0; j < recordGroups.length; ++j) seenGroups[recordGroups[j]] = 1;
            }
          }
          iterableGroupIndex = iterableGroupIndex.slice(0, remaining);
        } else {
          for (let i = 0; i < n; ++i) {
            if (reIndex[i] !== REMOVED_INDEX)
              seenGroups[(groupIndex[remaining++] = groupIndex[i])] = 1;
          }
        }
        groups = [];
        entries = resetNeeded ? [] : groups;
        k = 0;
        for (let i = 0; i < oldK; ++i) {
          if (seenGroups[i]) {
            seenGroups[i] = k++;
            if (resetNeeded) entries.push(oldEntries[i]);
            else groups.push(oldGroups[i]);
          }
        }
        if (k > 1 || iterable) {
          if (iterable) {
            for (let i = 0; i < remaining; ++i) {
              const recordGroups = iterableGroupIndex[i];
              for (let j = 0; j < recordGroups.length; ++j)
                recordGroups[j] = seenGroups[recordGroups[j]];
            }
          } else {
            for (let i = 0; i < remaining; ++i) groupIndex[i] = seenGroups[groupIndex[i]];
          }
        } else {
          groupIndex = arrays.array8(0);
        }
        setUpdate();
      } else if (k === 1 && !singleton) {
        for (let i = 0; i < n; ++i) if (reIndex[i] !== REMOVED_INDEX) return;
        entries = [];
        groups = [];
        k = 0;
        setUpdate();
      }
    }

    function updateMany(
      filterOne: number,
      filterOffset: number,
      added: number[],
      removed: number[],
      notFilter?: boolean,
    ) {
      if ((filterOne === one && filterOffset === offset) || resetNeeded) return;
      const { data, filters } = state;
      if (iterable) {
        for (let i = 0; i < added.length; ++i) {
          const recordIndex = added[i];
          if (filters.zeroExcept(recordIndex, offset, zero)) {
            const recordGroups = iterableGroupIndex[recordIndex];
            for (let j = 0; j < recordGroups.length; ++j) {
              const entry = groups[recordGroups[j]];
              entry.value = reduceAdd(entry.value, data[recordIndex], false, j);
            }
          }
        }
        for (let i = 0; i < removed.length; ++i) {
          const recordIndex = removed[i];
          if (filters.onlyExcept(recordIndex, offset, zero, filterOffset, filterOne)) {
            const recordGroups = iterableGroupIndex[recordIndex];
            for (let j = 0; j < recordGroups.length; ++j) {
              const entry = groups[recordGroups[j]];
              entry.value = reduceRemove(entry.value, data[recordIndex], notFilter, j);
            }
          }
        }
      } else {
        for (let i = 0; i < added.length; ++i) {
          const recordIndex = added[i];
          if (filters.zeroExcept(recordIndex, offset, zero)) {
            const entry = groups[groupIndex[recordIndex]];
            entry.value = reduceAdd(entry.value, data[recordIndex], false);
          }
        }
        for (let i = 0; i < removed.length; ++i) {
          const recordIndex = removed[i];
          if (filters.onlyExcept(recordIndex, offset, zero, filterOffset, filterOne)) {
            const entry = groups[groupIndex[recordIndex]];
            entry.value = reduceRemove(entry.value, data[recordIndex], notFilter);
          }
        }
      }
    }

    function updateOne(
      filterOne: number,
      filterOffset: number,
      added: number[],
      removed: number[],
      notFilter?: boolean,
    ) {
      if ((filterOne === one && filterOffset === offset) || resetNeeded) return;
      const { data, filters } = state;
      const entry = groups[0];
      for (let i = 0; i < added.length; ++i) {
        const recordIndex = added[i];
        if (filters.zeroExcept(recordIndex, offset, zero))
          entry.value = reduceAdd(entry.value, data[recordIndex], false);
      }
      for (let i = 0; i < removed.length; ++i) {
        const recordIndex = removed[i];
        if (filters.onlyExcept(recordIndex, offset, zero, filterOffset, filterOne))
          entry.value = reduceRemove(entry.value, data[recordIndex], notFilter);
      }
    }

    function reset() {
      const { data, filters, n } = state;
      if (!initializeGroups(entries, reduceInitial))
        throw new Error("Group value rejected the reducer initial value");
      groups = entries;
      if (k > 1 || iterable) {
        if (iterable) {
          for (let i = 0; i < n; ++i) {
            const recordGroups = iterableGroupIndex[i];
            for (let j = 0; j < recordGroups.length; ++j) {
              const entry = groups[recordGroups[j]];
              entry.value = reduceAdd(entry.value, data[i], true, j);
            }
          }
          for (let i = 0; i < n; ++i) {
            if (!filters.zeroExcept(i, offset, zero)) {
              const recordGroups = iterableGroupIndex[i];
              for (let j = 0; j < recordGroups.length; ++j) {
                const entry = groups[recordGroups[j]];
                entry.value = reduceRemove(entry.value, data[i], false, j);
              }
            }
          }
        } else {
          for (let i = 0; i < n; ++i) {
            const entry = groups[groupIndex[i]];
            entry.value = reduceAdd(entry.value, data[i], true);
          }
          for (let i = 0; i < n; ++i) {
            if (!filters.zeroExcept(i, offset, zero)) {
              const entry = groups[groupIndex[i]];
              entry.value = reduceRemove(entry.value, data[i], false);
            }
          }
        }
      } else if (k === 1) {
        const entry = groups[0];
        for (let i = 0; i < n; ++i) entry.value = reduceAdd(entry.value, data[i], true);
        for (let i = 0; i < n; ++i) {
          if (!filters.zeroExcept(i, offset, zero))
            entry.value = reduceRemove(entry.value, data[i], false);
        }
      }
    }

    function readValues() {
      if (resetNeeded) {
        reset();
        resetNeeded = false;
      }
      return groups;
    }

    function readTop(count: number) {
      readValues();
      if (retainedOrdering) {
        const selected = retainedOrdering.top(count);
        if (selected.length * Math.log2(groups.length) < groups.length) {
          return selected.map(
            (entry) => groups[groupBisect.left(groups, entry.key, 0, groups.length)],
          );
        }
        if (!groupLookup) {
          groupLookup = new Map();
          for (const entry of groups) groupLookup.set(entry, entry);
        }
        const lookup = groupLookup;
        return selected.map((entry) => {
          const current = lookup.get(entry);
          if (!current) throw new Error("Selected group is absent");
          return current;
        });
      }
      const selected = select(groups, 0, groups.length, count);
      return heap.sort(selected, 0, selected.length);
    }

    function setOrder(value: (value: Value) => NaturallyOrderedValue) {
      const next = createOrdering(currentView, value);
      select = next.select;
      heap = next.heap;
      ordering = next;
      retainedOrdering = undefined;
      return configured;
    }

    function setNaturalOrder() {
      select = heapselectBy.by((entry: Grouping<Key, Value>) => entry.value);
      heap = heapBy.by((entry: Grouping<Key, Value>) => entry.value);
      ordering = retainedOrdering = undefined;
      return configured;
    }

    function dispose() {
      let i = state.filterListeners.indexOf(update);
      if (i >= 0) state.filterListeners.splice(i, 1);
      i = dimension.indexListeners.indexOf(add);
      if (i >= 0) dimension.indexListeners.splice(i, 1);
      i = state.removeDataListeners.indexOf(remove);
      if (i >= 0) state.removeDataListeners.splice(i, 1);
      i = dimension.dimensionGroups.indexOf(configured);
      if (i >= 0) dimension.dimensionGroups.splice(i, 1);
      return configured;
    }

    const addIndex = dimension.indexListeners.indexOf(add);
    if (addIndex >= 0) dimension.indexListeners[addIndex] = addData;
    add = addData;
    const removeIndex = state.removeDataListeners.indexOf(remove);
    if (removeIndex >= 0) state.removeDataListeners[removeIndex] = removeData;
    remove = removeData;
    setUpdate();
    const currentView = Object.assign(view, {
      all: readValues,
      top: readTop,
      order: setOrder,
      orderNatural: setNaturalOrder,
      dispose,
    });
    const configured: Group<Record, Key, Value> = Object.assign(group, createGroupMethods(currentView), {
      reduce: configure,
      reduceCount,
      reduceSum,
      size,
    });
    return configured;
  }

  function size() {
    return k;
  }

  function reduceCount() {
    return configure(
      (value) => value + 1,
      (value) => value - 1,
      initialZero,
    );
  }

  function reduceSum(value: (record: Record) => number) {
    return configure(
      (total, record) => total + +value(record),
      (total, record) => total - value(record),
      initialZero,
    );
  }

  const configured = reduceCount();
  dimension.dimensionGroups.push(configured);
  add(dimension.values, dimension.index, 0, state.n);
  return configured;
}

export function createDimensionGroupAll<Record, DimensionValue>(
  state: CrossfilterState<Record>,
  dimension: DimensionGroupState<DimensionValue>,
): GroupAll<Record, number> {
  const internal = createGrouping(state, dimension, () => null, { key: null });
  const group = {};

  function expose<Value>(configured: Group<Record, null, Value>): GroupAll<Record, Value> {
    function reduce<NextValue>(
      add: Reducer<Record, NextValue>,
      remove: Reducer<Record, NextValue>,
      initial: () => NextValue,
    ) {
      return expose(configured.reduce(add, remove, initial));
    }

    function dispose() {
      configured.dispose();
      const index = dimension.dimensionGroups.indexOf(exposed);
      if (index >= 0) dimension.dimensionGroups.splice(index, 1);
      return exposed;
    }

    const exposed: GroupAll<Record, Value> = Object.assign(group, {
      reduce,
      reduceCount: () => expose(configured.reduceCount()),
      reduceSum: (value: (record: Record) => number) => expose(configured.reduceSum(value)),
      value: () => configured.all()[0].value,
      dispose,
      remove: dispose,
    });
    return exposed;
  }

  const exposed = expose(internal);
  dimension.dimensionGroups[dimension.dimensionGroups.indexOf(internal)] = exposed;
  return exposed;
}
