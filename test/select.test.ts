import { describe, expect, it } from "vitest";
import crossfilter from "../index.ts";

const descending = (a: number, b: number) => (a > b ? -1 : a < b ? 1 : 0);

const heapy = (array: readonly number[]) => {
  const n = array.length;
  for (let i = 1; i < n; ++i) {
    if (array[i] < array[(i - 1) >> 1]) {
      return false;
    }
  }
  return true;
};

describe("select", () => {
  describe("heapselect", () => {
    const select = crossfilter.heapselect;

    it("can select from a small array of positive integers", () => {
      const array = [6, 5, 3, 1, 8, 7, 2, 4];
      expect(select(array, 0, array.length, 1)).toStrictEqual([8]);
      expect(select(array, 0, array.length, 2).sort(descending)).toStrictEqual([8, 7]);
      expect(select(array, 0, array.length, 3).sort(descending)).toStrictEqual([8, 7, 6]);
      expect(select(array, 0, array.length, 4).sort(descending)).toStrictEqual([8, 7, 6, 5]);
      expect(select(array, 0, array.length, 5).sort(descending)).toStrictEqual([8, 7, 6, 5, 4]);
      expect(select(array, 0, array.length, 6).sort(descending)).toStrictEqual([8, 7, 6, 5, 4, 3]);
      expect(select(array, 0, array.length, 7).sort(descending)).toStrictEqual([
        8, 7, 6, 5, 4, 3, 2,
      ]);
      expect(select(array, 0, array.length, 8).sort(descending)).toStrictEqual([
        8, 7, 6, 5, 4, 3, 2, 1,
      ]);
    });

    it("does not affect the original order; returns a copy", () => {
      const array = [6, 5, 3, 1, 8, 7, 2, 4];
      select(array, 0, array.length, 4);
      expect(array).toStrictEqual([6, 5, 3, 1, 8, 7, 2, 4]);
    });

    it("returns fewer than k elements when k is too big", () => {
      const array = [6, 5, 3, 1, 8, 7, 2, 4];
      expect(select(array, 0, array.length, 8).sort(descending)).toStrictEqual([
        8, 7, 6, 5, 4, 3, 2, 1,
      ]);
    });

    it("returns an empty array when selecting nothing", () => {
      const array: { value: number }[] = [];
      const select2 = select.by((d: { value: number }) => d.value);
      expect(select2(array, 0, array.length, 1)).toStrictEqual([]);
    });

    it("the returned array is a binary heap", () => {
      const array = [6, 5, 3, 1, 8, 7, 2, 4];
      for (let i = 0; i < 10; ++i) expect(heapy(select(array, 0, array.length, i))).toBe(true);
    });
  });
});
