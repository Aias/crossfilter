import initialZero from "./zero.js";
import type { CrossfilterState, DataListener, FilterListener } from "./state.js";

export type Reducer<Record, Value> = (
  value: Value,
  record: Record,
  notFilter: boolean | undefined,
  index?: number,
) => Value;

export interface GroupAll<Record, Value> {
  reduce<NextValue>(
    add: Reducer<Record, NextValue>,
    remove: Reducer<Record, NextValue>,
    initial: () => NextValue,
  ): GroupAll<Record, NextValue>;
  reduceCount(): GroupAll<Record, number>;
  reduceSum(value: (record: Record) => number): GroupAll<Record, number>;
  value(): Value;
  dispose(): GroupAll<Record, Value>;
  remove(): GroupAll<Record, Value>;
}

function createGroupAllMethods<Record, Value>(view: Pick<GroupAll<Record, Value>, "value" | "dispose">) {
  const dispose = () => view.dispose();
  return {
    value: () => view.value(),
    dispose,
    remove: dispose,
  };
}

export default function createGroupAll<Record>(
  state: CrossfilterState<Record>,
): GroupAll<Record, number> {
  const group = {};
  const view = {};
  let update: FilterListener = () => {};
  let add: DataListener<Record> = () => {};
  state.filterListeners.push(update);
  state.dataListeners.push(add);

  function configure<Value>(
    reduceAdd: Reducer<Record, Value>,
    reduceRemove: Reducer<Record, Value>,
    reduceInitial: () => Value,
  ): GroupAll<Record, Value> {
    let reduceValue: Value;
    let resetNeeded = true;

    function addData(_newData: Record[], n0: number) {
      if (resetNeeded) return;
      const { data, filters, n } = state;
      for (let i = n0; i < n; ++i) {
        reduceValue = reduceAdd(reduceValue, data[i], true);
        if (!filters.zero(i)) reduceValue = reduceRemove(reduceValue, data[i], false);
      }
    }

    function updateFilters(
      filterOne: number,
      filterOffset: number,
      added: number[],
      removed: number[],
      notFilter?: boolean,
    ) {
      if (resetNeeded) return;
      const { data, filters } = state;
      for (let i = 0; i < added.length; ++i) {
        const index = added[i];
        if (filters.zero(index)) reduceValue = reduceAdd(reduceValue, data[index], notFilter);
      }
      for (let i = 0; i < removed.length; ++i) {
        const index = removed[i];
        if (filters.only(index, filterOffset, filterOne))
          reduceValue = reduceRemove(reduceValue, data[index], notFilter);
      }
    }

    function readValue() {
      if (resetNeeded) {
        const { data, filters, n } = state;
        reduceValue = reduceInitial();
        for (let i = 0; i < n; ++i) {
          reduceValue = reduceAdd(reduceValue, data[i], true);
          if (!filters.zero(i)) reduceValue = reduceRemove(reduceValue, data[i], false);
        }
        resetNeeded = false;
      }
      return reduceValue;
    }

    function dispose() {
      let i = state.filterListeners.indexOf(update);
      if (i >= 0) state.filterListeners.splice(i, 1);
      i = state.dataListeners.indexOf(add);
      if (i >= 0) state.dataListeners.splice(i, 1);
      return configured;
    }

    const filterIndex = state.filterListeners.indexOf(update);
    if (filterIndex >= 0) state.filterListeners[filterIndex] = updateFilters;
    update = updateFilters;
    const dataIndex = state.dataListeners.indexOf(add);
    if (dataIndex >= 0) state.dataListeners[dataIndex] = addData;
    add = addData;
    const currentView = Object.assign(view, { value: readValue, dispose });
    const configured: GroupAll<Record, Value> = Object.assign(group, createGroupAllMethods(currentView), {
      reduce: configure,
      reduceCount,
      reduceSum,
    });
    return configured;
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

  return reduceCount();
}
