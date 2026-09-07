import crossfilter from "../main.js";
import { describe, expect, it } from "vitest";

describe("iterable dimension accessors", () => {
  for (const values of [Int32Array.of(1, 2), { 0: 1, 1: 2, length: 2 }, "12"]) {
    it(`accepts ${values.constructor.name} values`, () => {
      const records = [{ values }];
      const source = crossfilter(records);
      const accessor = (record) => record.values;
      const dimension = source.dimension(accessor, true);
      expect(dimension.accessor).toBe(accessor);
      expect(dimension.groupAll().value()).toBe(2);
      expect(dimension.filterExact(values[0]).bottom(Infinity)).toEqual(records);
    });
  }
});
