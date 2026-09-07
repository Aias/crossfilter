import { describe, expect, it } from "vitest";
import crossfilter from "../index.ts";

describe("heap", () => {
  const heap = crossfilter.heap;

  it("children are greater than or equal to parents", () => {
    const array = [6, 5, 3, 1, 8, 7, 2, 4];
    const n = array.length;
    expect(heap(array, 0, n)).toBe(array);
    expect(array[0]).toBe(1);
    for (let i = 1; i < n; ++i) expect(array[i] >= array[(i - 1) >> 1]).toBe(true);
  });

  it("creates a heap from a subset of the array", () => {
    const array = [6, 5, 3, 1, 8, 7, 2, 4];
    const n = 6;
    expect(heap(array, 0, n)).toBe(array);
    expect(array[0]).toBe(1);
    for (let i = 1; i < n; ++i) expect(array[i] >= array[(i - 1) >> 1]).toBe(true);
  });

  describe("sort", () => {
    it("sorts an existing heap in descending order", () => {
      const array = [1, 4, 2, 5, 8, 7, 3, 6];
      const n = array.length;
      heap.sort(array, 0, n);
      expect(array).toStrictEqual([8, 7, 6, 5, 4, 3, 2, 1]);
    });

    it("sorts a two-element heap in descending order", () => {
      const array = [1, 4];
      const n = array.length;
      heap.sort(array, 0, n);
      expect(array).toStrictEqual([4, 1]);
    });
  });
});
