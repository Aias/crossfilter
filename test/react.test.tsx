import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import crossfilter from "../index.ts";
import type { Crossfilter } from "../index.ts";
import {
  useCrossfilter,
  useCrossfilterVersion,
  useDimensionFilter,
  useDimensionTop,
  useGroupAll,
  useGroupValue,
} from "../react.ts";

interface Sale {
  amount: number;
  type: string;
}

const sales: Sale[] = [
  { amount: 10, type: "cash" },
  { amount: 20, type: "card" },
  { amount: 30, type: "cash" },
];

function createSource() {
  const source = crossfilter(sales);
  const amount = source.dimension((sale) => sale.amount);
  const type = source.dimension((sale) => sale.type);
  return {
    source,
    amount,
    type,
    byType: type.group(),
    total: source.groupAll().reduceSum((sale) => sale.amount),
  };
}

describe("useCrossfilterVersion", () => {
  it("re-renders when a filter changes", () => {
    const { source, amount } = createSource();
    const { result } = renderHook(() => useCrossfilterVersion(source));
    const before = result.current;
    act(() => {
      amount.filterRange([15, 35]);
    });
    expect(result.current).toBe(before + 1);
  });

  it("shares one subscription per crossfilter", () => {
    const { source, amount } = createSource();
    const first = renderHook(() => useCrossfilterVersion(source));
    const second = renderHook(() => useCrossfilterVersion(source));
    act(() => {
      amount.filterExact(10);
    });
    expect(first.result.current).toBe(second.result.current);
  });
});

describe("useGroupAll", () => {
  it("returns a snapshot that only changes when the crossfilter does", () => {
    const { source, amount, byType } = createSource();
    const { result, rerender } = renderHook(() => useGroupAll(source, byType));
    expect(result.current).toEqual([
      { key: "card", value: 1 },
      { key: "cash", value: 2 },
    ]);
    const snapshot = result.current;
    rerender();
    expect(result.current).toBe(snapshot);
    act(() => {
      amount.filterRange([15, 35]);
    });
    expect(result.current).not.toBe(snapshot);
    expect(result.current).toEqual([
      { key: "card", value: 1 },
      { key: "cash", value: 1 },
    ]);
  });
});

describe("useGroupValue", () => {
  it("tracks a reduced value across filters", () => {
    const { source, type, total } = createSource();
    const { result } = renderHook(() => useGroupValue(source, total));
    expect(result.current).toBe(60);
    act(() => {
      type.filterExact("cash");
    });
    expect(result.current).toBe(40);
  });
});

describe("useDimensionTop", () => {
  it("returns the top records under the current filters", () => {
    const { source, amount, type } = createSource();
    const { result } = renderHook(() => useDimensionTop(source, amount, 2));
    expect(result.current.map((sale) => sale.amount)).toEqual([30, 20]);
    act(() => {
      type.filterExact("cash");
    });
    expect(result.current.map((sale) => sale.amount)).toEqual([30, 10]);
  });
});

describe("useDimensionFilter", () => {
  it("exposes the current filter and applies updates", () => {
    const { source, amount, total } = createSource();
    const { result } = renderHook(() => ({
      filter: useDimensionFilter(source, amount),
      total: useGroupValue(source, total),
    }));
    expect(result.current.filter[0]).toBeUndefined();
    act(() => {
      result.current.filter[1]([15, 35]);
    });
    expect(result.current.filter[0]).toEqual([15, 35]);
    expect(result.current.total).toBe(50);
    act(() => {
      result.current.filter[1](null);
    });
    expect(result.current.filter[0]).toBeUndefined();
    expect(result.current.total).toBe(60);
  });
});

describe("useCrossfilter", () => {
  it("builds the model once and replaces records when they change", () => {
    const build = (source: Crossfilter<Sale>) => ({
      source,
      total: source.groupAll().reduceSum((sale) => sale.amount),
    });
    const { result, rerender } = renderHook(
      ({ records }) => {
        const model = useCrossfilter(records, build);
        return { model, total: useGroupValue(model.source, model.total) };
      },
      { initialProps: { records: sales } },
    );
    const { model } = result.current;
    rerender({ records: sales });
    expect(result.current.model).toBe(model);
    expect(result.current.total).toBe(60);
    rerender({ records: [{ amount: 5, type: "cash" }] });
    expect(result.current.model).toBe(model);
    expect(model.source.all()).toEqual([{ amount: 5, type: "cash" }]);
    expect(result.current.total).toBe(5);
  });
});
