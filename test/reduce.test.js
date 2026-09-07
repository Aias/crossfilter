import crossfilter from "../main.js";
import { describe, expect, it } from "vitest";

describe("reducer configuration", () => {
  it("keeps saved group methods connected to the active reducer", () => {
    const source = crossfilter([
      { key: 1, amount: 4 },
      { key: 2, amount: 7 },
    ]);
    const group = source.dimension((record) => record.key).group();
    const all = group.all;
    const top = group.top;
    group.reduceSum((record) => record.amount);
    expect(all()).toEqual([
      { key: 1, value: 4 },
      { key: 2, value: 7 },
    ]);
    source.add([{ key: 3, amount: 9 }]);
    expect(top(1)).toEqual([{ key: 3, value: 9 }]);
  });

  it("keeps saved singleton readers connected to the active reducer", () => {
    const source = crossfilter([{ amount: 4 }, { amount: 7 }]);
    for (const group of [
      source.groupAll(),
      source.dimension((record) => record.amount).groupAll(),
    ]) {
      const value = group.value;
      group.reduceSum((record) => record.amount);
      expect(value()).toBe(11);
    }
  });

  it("preserves custom ordering across reducer changes", () => {
    const source = crossfilter([
      { key: 1, amount: 4 },
      { key: 2, amount: 7 },
    ]);
    const group = source
      .dimension((record) => record.key)
      .group()
      .order((value) => -value);
    group.reduceSum((record) => record.amount);
    expect(group.top(1)).toEqual([{ key: 1, value: 4 }]);
    expect(group.top(Infinity)).toEqual([
      { key: 1, value: 4 },
      { key: 2, value: 7 },
    ]);
  });

  it("coerces sum inputs consistently for groups and singletons", () => {
    const source = crossfilter([
      { key: 1, amount: "4" },
      { key: 2, amount: "7" },
    ]);
    const dimension = source.dimension((record) => record.key);
    expect(
      dimension
        .group()
        .reduceSum((record) => record.amount)
        .all(),
    ).toEqual([
      { key: 1, value: 4 },
      { key: 2, value: 7 },
    ]);
    expect(
      dimension
        .groupAll()
        .reduceSum((record) => record.amount)
        .value(),
    ).toBe(11);
    expect(
      source
        .groupAll()
        .reduceSum((record) => record.amount)
        .value(),
    ).toBe(11);
  });
});
