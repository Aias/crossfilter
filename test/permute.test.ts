import { describe, expect, it } from "vitest";
import crossfilter from "../index.ts";

describe("permute", () => {
  const permute = crossfilter.permute;

  it("permutes according to the specified index", () => {
    expect(permute([3, 4, 5], [2, 1, 0])).toStrictEqual([5, 4, 3]);
    expect(permute([3, 4, 5], [2, 0, 1])).toStrictEqual([5, 3, 4]);
    expect(permute([3, 4, 5], [0, 1, 2])).toStrictEqual([3, 4, 5]);
  });

  it("does not modify the input array", () => {
    const input = [3, 4, 5];
    permute(input, [2, 1, 0]);
    expect(input).toStrictEqual([3, 4, 5]);
  });

  it("can duplicate input values", () => {
    expect(permute([3, 4, 5], [0, 1, 0])).toStrictEqual([3, 4, 3]);
    expect(permute([3, 4, 5], [2, 2, 2])).toStrictEqual([5, 5, 5]);
    expect(permute([3, 4, 5], [0, 1, 1])).toStrictEqual([3, 4, 4]);
  });

  it("can return more elements", () => {
    expect(permute([3, 4, 5], [0, 0, 1, 2])).toStrictEqual([3, 3, 4, 5]);
    expect(permute([3, 4, 5], [0, 1, 1, 1])).toStrictEqual([3, 4, 4, 4]);
  });

  it("can return fewer elements", () => {
    expect(permute([3, 4, 5], [0])).toStrictEqual([3]);
    expect(permute([3, 4, 5], [1, 2])).toStrictEqual([4, 5]);
    expect(permute([3, 4, 5], [])).toStrictEqual([]);
  });

  it("can return undefined elements", () => {
    const v1 = permute([3, 4, 5], [10]);
    expect(v1.length).toBe(1);
    expect(v1[0]).toBeUndefined();
    const v2 = permute([3, 4, 5], [-1]);
    expect(v2.length).toBe(1);
    expect(v2[0]).toBeUndefined();
    const v3 = permute([3, 4, 5], [0, -1]);
    expect(v3.length).toBe(2);
    expect(v3[0]).toBe(3);
    expect(v3[1]).toBeUndefined();
  });
});
