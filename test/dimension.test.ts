import { beforeEach, describe, expect, it, vi } from "vitest";
import crossfilter from "../index.ts";
import type { Crossfilter, Dimension, Group, GroupAll } from "../index.ts";
import { createFixture } from "./fixtures.ts";
import type { Fixture, Sale } from "./fixtures.ts";

const range = (start: number, stop: number) =>
  Array.from({ length: stop - start }, (_, i) => start + i);

describe("dimension", () => {
  let data: Fixture;

  beforeEach(() => {
    data = createFixture();
  });

  it("accessor", () => {
    const source = crossfilter<{ type: string }>();
    const type = source.dimension((d) => d.type);
    expect(type.accessor({ type: "a type" })).toBe("a type");
  });

  it("stringAccessor", () => {
    const source = crossfilter<{ type: string }>();
    const typeByString = source.dimension("type");
    expect(typeByString.accessor({ type: "a type" })).toBe("a type");
  });

  it("stringPathAccessor", () => {
    const source = crossfilter<{ tags: number[] }>();
    const firstTag = source.dimension("tags[0]");
    expect(firstTag.accessor({ tags: [2, 4, 5] })).toBe(2);
    expect(firstTag.accessor({ tags: [4, 5] })).toBe(4);
  });

  it("stringPathDotAccessor", () => {
    const source = crossfilter<{ tags: number[] }>();
    const firstTagDot = source.dimension("tags.0");
    expect(firstTagDot.accessor({ tags: [2, 4, 5] })).toBe(2);
    expect(firstTagDot.accessor({ tags: [4, 5] })).toBe(4);
  });

  it("stringFunctionCallAccessor", () => {
    function getYear(this: { date: string }) {
      return new Date(this.date).getFullYear();
    }
    const source = crossfilter<{ date: string; getYear: typeof getYear }>();
    const year = source.dimension("getYear");
    expect(year.accessor({ date: "2011-11-14T16:28:54Z", getYear })).toBe(2011);
  });

  describe("top", () => {
    it("returns the top k records by value, in descending order", () => {
      expect(data.total.top(3)).toStrictEqual([
        {
          date: "2011-11-14T16:28:54Z",
          quantity: 1,
          total: 300,
          tip: 200,
          type: "visa",
          tags: [2, 4, 5],
        },
        {
          date: "2011-11-14T20:49:07Z",
          quantity: 2,
          total: 290,
          tip: 200,
          type: "tab",
          tags: [2, 4, 5],
        },
        {
          date: "2011-11-14T21:18:48Z",
          quantity: 4,
          total: 270,
          tip: 0,
          type: "tab",
          tags: [1, 2, 3],
        },
      ]);
      expect(data.date.top(3)).toStrictEqual([
        {
          date: "2011-11-14T23:28:54Z",
          quantity: 2,
          total: 190,
          tip: 100,
          type: "tab",
          tags: [1, 2, 3],
        },
        {
          date: "2011-11-14T23:23:29Z",
          quantity: 2,
          total: 190,
          tip: 100,
          type: "tab",
          tags: [2, 3, 4],
        },
        {
          date: "2011-11-14T23:21:22Z",
          quantity: 2,
          total: 190,
          tip: 100,
          type: "tab",
          tags: [2, 4, 5],
        },
      ]);
    });

    it("returns the top k records, using offset, by value, in descending order", () => {
      expect(data.total.top(3, 1)).toStrictEqual([
        {
          date: "2011-11-14T20:49:07Z",
          quantity: 2,
          total: 290,
          tip: 200,
          type: "tab",
          tags: [2, 4, 5],
        },
        {
          date: "2011-11-14T21:18:48Z",
          quantity: 4,
          total: 270,
          tip: 0,
          type: "tab",
          tags: [1, 2, 3],
        },
        {
          date: "2011-11-14T23:16:09Z",
          quantity: 1,
          total: 200,
          tip: 100,
          type: "visa",
          tags: [2, 4, 5],
        },
      ]);
      expect(data.date.top(3, 10)).toStrictEqual([
        {
          date: "2011-11-14T22:30:22Z",
          quantity: 2,
          total: 89,
          tip: 0,
          type: "tab",
          tags: [1, 3],
        },
        {
          date: "2011-11-14T21:31:05Z",
          quantity: 2,
          total: 90,
          tip: 0,
          type: "tab",
          tags: [1, 2, 3],
        },
        {
          date: "2011-11-14T21:30:55Z",
          quantity: 2,
          total: 190,
          tip: 100,
          type: "tab",
          tags: [2, 3, 4],
        },
      ]);
    });

    it("observes the associated dimension's filters", () => {
      try {
        data.quantity.filterExact(4);
        expect(data.total.top(3)).toStrictEqual([
          {
            date: "2011-11-14T21:18:48Z",
            quantity: 4,
            total: 270,
            tip: 0,
            type: "tab",
            tags: [1, 2, 3],
          },
        ]);
      } finally {
        data.quantity.filterAll();
      }
      try {
        data.date.filterRange([
          new Date(Date.UTC(2011, 10, 14, 19)),
          new Date(Date.UTC(2011, 10, 14, 20)),
        ]);
        expect(data.date.top(10)).toStrictEqual([
          {
            date: "2011-11-14T19:30:44Z",
            quantity: 2,
            total: 90,
            tip: 0,
            type: "tab",
            tags: [1, 3],
          },
          {
            date: "2011-11-14T19:04:22Z",
            quantity: 2,
            total: 90,
            tip: 0,
            type: "tab",
            tags: [1, 2, 3],
          },
          {
            date: "2011-11-14T19:00:31Z",
            quantity: 2,
            total: 190,
            tip: 100,
            type: "tab",
            tags: [2, 3, 4],
          },
        ]);
        expect(data.date.top(10, 2)).toStrictEqual([
          {
            date: "2011-11-14T19:00:31Z",
            quantity: 2,
            total: 190,
            tip: 100,
            type: "tab",
            tags: [2, 3, 4],
          },
        ]);
      } finally {
        data.date.filterAll();
      }
    });

    it("observes other dimensions' filters", () => {
      try {
        data.type.filterExact("tab");
        expect(data.total.top(2)).toStrictEqual([
          {
            date: "2011-11-14T20:49:07Z",
            quantity: 2,
            total: 290,
            tip: 200,
            type: "tab",
            tags: [2, 4, 5],
          },
          {
            date: "2011-11-14T21:18:48Z",
            quantity: 4,
            total: 270,
            tip: 0,
            type: "tab",
            tags: [1, 2, 3],
          },
        ]);
        expect(data.total.top(2, 8)).toStrictEqual([
          {
            date: "2011-11-14T22:34:28Z",
            quantity: 2,
            total: 190,
            tip: 100,
            type: "tab",
            tags: [2, 4, 5],
          },
          {
            date: "2011-11-14T21:30:55Z",
            quantity: 2,
            total: 190,
            tip: 100,
            type: "tab",
            tags: [2, 3, 4],
          },
        ]);
        data.type.filterExact("visa");
        expect(data.total.top(1)).toStrictEqual([
          {
            date: "2011-11-14T16:28:54Z",
            quantity: 1,
            total: 300,
            tip: 200,
            type: "visa",
            tags: [2, 4, 5],
          },
        ]);
        data.quantity.filterExact(2);
        expect(data.tip.top(1)).toStrictEqual([
          {
            date: "2011-11-14T17:38:40Z",
            quantity: 2,
            total: 200,
            tip: 100,
            type: "visa",
            tags: [2, 4, 5],
          },
        ]);
      } finally {
        data.type.filterAll();
        data.quantity.filterAll();
      }
      try {
        data.type.filterExact("tab");
        expect(data.date.top(2)).toStrictEqual([
          {
            date: "2011-11-14T23:28:54Z",
            quantity: 2,
            total: 190,
            tip: 100,
            type: "tab",
            tags: [1, 2, 3],
          },
          {
            date: "2011-11-14T23:23:29Z",
            quantity: 2,
            total: 190,
            tip: 100,
            type: "tab",
            tags: [2, 3, 4],
          },
        ]);
        expect(data.date.top(2, 8)).toStrictEqual([
          {
            date: "2011-11-14T22:30:22Z",
            quantity: 2,
            total: 89,
            tip: 0,
            type: "tab",
            tags: [1, 3],
          },
          {
            date: "2011-11-14T21:31:05Z",
            quantity: 2,
            total: 90,
            tip: 0,
            type: "tab",
            tags: [1, 2, 3],
          },
        ]);
        data.type.filterExact("visa");
        expect(data.date.top(1)).toStrictEqual([
          {
            date: "2011-11-14T23:16:09Z",
            quantity: 1,
            total: 200,
            tip: 100,
            type: "visa",
            tags: [2, 4, 5],
          },
        ]);
        data.quantity.filterExact(2);
        expect(data.date.top(1)).toStrictEqual([
          {
            date: "2011-11-14T22:58:54Z",
            quantity: 2,
            total: 100,
            tip: 0,
            type: "visa",
            tags: [2, 3, 4],
          },
        ]);
      } finally {
        data.type.filterAll();
        data.quantity.filterAll();
      }
    });

    it("negative or zero k returns an empty array", () => {
      expect(data.quantity.top(0)).toStrictEqual([]);
      expect(data.quantity.top(-1)).toStrictEqual([]);
      expect(data.quantity.top(NaN)).toStrictEqual([]);
      expect(data.quantity.top(-Infinity)).toStrictEqual([]);
      expect(data.quantity.top(0, 0)).toStrictEqual([]);
      expect(data.quantity.top(-1, -1)).toStrictEqual([]);
      expect(data.quantity.top(NaN, NaN)).toStrictEqual([]);
      expect(data.quantity.top(-Infinity, -Infinity)).toStrictEqual([]);
      expect(data.date.top(0)).toStrictEqual([]);
      expect(data.date.top(-1)).toStrictEqual([]);
      expect(data.date.top(NaN)).toStrictEqual([]);
      expect(data.date.top(-Infinity)).toStrictEqual([]);
      expect(data.date.top(0, 0)).toStrictEqual([]);
      expect(data.date.top(-1, -1)).toStrictEqual([]);
      expect(data.date.top(NaN, NaN)).toStrictEqual([]);
      expect(data.date.top(-Infinity, -Infinity)).toStrictEqual([]);
    });
  });

  describe("bottom", () => {
    it("returns the bottom k records by value, in descending order", () => {
      expect(data.total.bottom(3)).toStrictEqual([
        {
          date: "2011-11-14T22:30:22Z",
          quantity: 2,
          total: 89,
          tip: 0,
          type: "tab",
          tags: [1, 3],
        },
        {
          date: "2011-11-14T16:30:43Z",
          quantity: 2,
          total: 90,
          tip: 0,
          type: "tab",
          tags: [2, 3, 4],
        },
        {
          date: "2011-11-14T16:48:46Z",
          quantity: 2,
          total: 90,
          tip: 0,
          type: "tab",
          tags: [1, 2, 3],
        },
      ]);
      expect(data.date.bottom(3)).toStrictEqual([
        {
          date: "2011-11-14T16:17:54Z",
          quantity: 2,
          total: 190,
          tip: 100,
          type: "tab",
          tags: [1, 2, 3],
        },
        {
          date: "2011-11-14T16:20:19Z",
          quantity: 2,
          total: 190,
          tip: 100,
          type: "tab",
          tags: [1, 3],
        },
        {
          date: "2011-11-14T16:28:54Z",
          quantity: 1,
          total: 300,
          tip: 200,
          type: "visa",
          tags: [2, 4, 5],
        },
      ]);
    });

    it("returns the bottom k records, using offset, by value, in descending order", () => {
      expect(data.total.bottom(3, 1)).toStrictEqual([
        {
          date: "2011-11-14T16:30:43Z",
          quantity: 2,
          total: 90,
          tip: 0,
          type: "tab",
          tags: [2, 3, 4],
        },
        {
          date: "2011-11-14T16:48:46Z",
          quantity: 2,
          total: 90,
          tip: 0,
          type: "tab",
          tags: [1, 2, 3],
        },
        {
          date: "2011-11-14T16:53:41Z",
          quantity: 2,
          total: 90,
          tip: 0,
          type: "tab",
          tags: [1, 3],
        },
      ]);
      expect(data.date.bottom(3, 10)).toStrictEqual([
        {
          date: "2011-11-14T17:25:45Z",
          quantity: 2,
          total: 200,
          tip: null,
          type: "cash",
          tags: [2, 4, 5],
        },
        {
          date: "2011-11-14T17:29:52Z",
          quantity: 1,
          total: 200,
          tip: 100,
          type: "visa",
          tags: [-1, 0, 3, 4],
        },
        {
          date: "2011-11-14T17:33:46Z",
          quantity: 2,
          total: 190,
          tip: 100,
          type: "tab",
          tags: [1, 2, 3],
        },
      ]);
    });

    it("observes the associated dimension's filters", () => {
      try {
        data.quantity.filterExact(4);
        expect(data.total.bottom(3)).toStrictEqual([
          {
            date: "2011-11-14T21:18:48Z",
            quantity: 4,
            total: 270,
            tip: 0,
            type: "tab",
            tags: [1, 2, 3],
          },
        ]);
      } finally {
        data.quantity.filterAll();
      }
      try {
        data.date.filterRange([
          new Date(Date.UTC(2011, 10, 14, 19)),
          new Date(Date.UTC(2011, 10, 14, 20)),
        ]);
        expect(data.date.bottom(10)).toStrictEqual([
          {
            date: "2011-11-14T19:00:31Z",
            quantity: 2,
            total: 190,
            tip: 100,
            type: "tab",
            tags: [2, 3, 4],
          },
          {
            date: "2011-11-14T19:04:22Z",
            quantity: 2,
            total: 90,
            tip: 0,
            type: "tab",
            tags: [1, 2, 3],
          },
          {
            date: "2011-11-14T19:30:44Z",
            quantity: 2,
            total: 90,
            tip: 0,
            type: "tab",
            tags: [1, 3],
          },
        ]);
        expect(data.date.bottom(10, 2)).toStrictEqual([
          {
            date: "2011-11-14T19:30:44Z",
            quantity: 2,
            total: 90,
            tip: 0,
            type: "tab",
            tags: [1, 3],
          },
        ]);
      } finally {
        data.date.filterAll();
      }
    });

    it("observes other dimensions' filters", () => {
      try {
        data.type.filterExact("tab");
        expect(data.total.bottom(2)).toStrictEqual([
          {
            date: "2011-11-14T22:30:22Z",
            quantity: 2,
            total: 89,
            tip: 0,
            type: "tab",
            tags: [1, 3],
          },
          {
            date: "2011-11-14T16:30:43Z",
            quantity: 2,
            total: 90,
            tip: 0,
            type: "tab",
            tags: [2, 3, 4],
          },
        ]);
        data.type.filterExact("tab");
        expect(data.total.bottom(2, 8)).toStrictEqual([
          {
            date: "2011-11-14T17:52:02Z",
            quantity: 2,
            total: 90,
            tip: 0,
            type: "tab",
            tags: [2, 3, 4],
          },
          {
            date: "2011-11-14T18:45:24Z",
            quantity: 2,
            total: 90,
            tip: 0,
            type: "tab",
            tags: [2, 4, 5],
          },
        ]);
        data.type.filterExact("visa");
        expect(data.total.bottom(1)).toStrictEqual([
          {
            date: "2011-11-14T22:58:54Z",
            quantity: 2,
            total: 100,
            tip: 0,
            type: "visa",
            tags: [2, 3, 4],
          },
        ]);
        data.quantity.filterExact(2);
        expect(data.tip.bottom(1)).toStrictEqual([
          {
            date: "2011-11-14T22:58:54Z",
            quantity: 2,
            total: 100,
            tip: 0,
            type: "visa",
            tags: [2, 3, 4],
          },
        ]);
      } finally {
        data.type.filterAll();
        data.quantity.filterAll();
      }
      try {
        data.type.filterExact("tab");
        expect(data.date.bottom(2)).toStrictEqual([
          {
            date: "2011-11-14T16:17:54Z",
            quantity: 2,
            total: 190,
            tip: 100,
            type: "tab",
            tags: [1, 2, 3],
          },
          {
            date: "2011-11-14T16:20:19Z",
            quantity: 2,
            total: 190,
            tip: 100,
            type: "tab",
            tags: [1, 3],
          },
        ]);
        expect(data.date.bottom(2, 8)).toStrictEqual([
          {
            date: "2011-11-14T17:33:46Z",
            quantity: 2,
            total: 190,
            tip: 100,
            type: "tab",
            tags: [1, 2, 3],
          },
          {
            date: "2011-11-14T17:33:59Z",
            quantity: 2,
            total: 90,
            tip: 0,
            type: "tab",
            tags: [1, 3],
          },
        ]);
        data.type.filterExact("visa");
        expect(data.date.bottom(1)).toStrictEqual([
          {
            date: "2011-11-14T16:28:54Z",
            quantity: 1,
            total: 300,
            tip: 200,
            type: "visa",
            tags: [2, 4, 5],
          },
        ]);
        data.quantity.filterExact(2);
        expect(data.date.bottom(1)).toStrictEqual([
          {
            date: "2011-11-14T17:38:40Z",
            quantity: 2,
            total: 200,
            tip: 100,
            type: "visa",
            tags: [2, 4, 5],
          },
        ]);
      } finally {
        data.type.filterAll();
        data.quantity.filterAll();
      }
    });

    it("negative or zero k returns an empty array", () => {
      expect(data.quantity.bottom(0)).toStrictEqual([]);
      expect(data.quantity.bottom(-1)).toStrictEqual([]);
      expect(data.quantity.bottom(NaN)).toStrictEqual([]);
      expect(data.quantity.bottom(-Infinity)).toStrictEqual([]);
      expect(data.quantity.bottom(0, 0)).toStrictEqual([]);
      expect(data.quantity.bottom(-1, -1)).toStrictEqual([]);
      expect(data.quantity.bottom(NaN, NaN)).toStrictEqual([]);
      expect(data.quantity.bottom(-Infinity, -Infinity)).toStrictEqual([]);
      expect(data.date.bottom(0)).toStrictEqual([]);
      expect(data.date.bottom(-1)).toStrictEqual([]);
      expect(data.date.bottom(NaN)).toStrictEqual([]);
      expect(data.date.bottom(-Infinity)).toStrictEqual([]);
      expect(data.date.bottom(0, 0)).toStrictEqual([]);
      expect(data.date.bottom(-1, -1)).toStrictEqual([]);
      expect(data.date.bottom(NaN, NaN)).toStrictEqual([]);
      expect(data.date.bottom(-Infinity, -Infinity)).toStrictEqual([]);
    });
  });

  describe("filterExact", () => {
    it("selects records that match the specified value exactly", () => {
      try {
        data.tip.filterExact(100);
        expect(data.date.top(2)).toStrictEqual([
          {
            date: "2011-11-14T23:28:54Z",
            quantity: 2,
            total: 190,
            tip: 100,
            type: "tab",
            tags: [1, 2, 3],
          },
          {
            date: "2011-11-14T23:23:29Z",
            quantity: 2,
            total: 190,
            tip: 100,
            type: "tab",
            tags: [2, 3, 4],
          },
        ]);
      } finally {
        data.tip.filterAll();
      }
    });

    it("allows the filter value to be null", () => {
      try {
        data.tip.filterExact(null);
        expect(data.date.top(2)).toStrictEqual([
          {
            date: "2011-11-14T22:58:54Z",
            quantity: 2,
            total: 100,
            tip: 0,
            type: "visa",
            tags: [2, 3, 4],
          },
          {
            date: "2011-11-14T22:48:05Z",
            quantity: 2,
            total: 91,
            tip: 0,
            type: "tab",
            tags: [2, 4, 5],
          },
        ]);
      } finally {
        data.tip.filterAll();
      }
    });
  });

  describe("filterRange", () => {
    it("selects records greater than or equal to the inclusive lower bound", () => {
      try {
        data.total.filterRange([100, 190]);
        expect(data.date.top(Infinity).every((d) => d.total >= 100)).toBe(true);
        data.total.filterRange([110, 190]);
        expect(data.date.top(Infinity).every((d) => d.total >= 110)).toBe(true);
      } finally {
        data.total.filterAll();
      }
    });

    it("selects records less than the exclusive lower bound", () => {
      try {
        data.total.filterRange([100, 200]);
        expect(data.date.top(Infinity).every((d) => d.total < 200)).toBe(true);
        data.total.filterRange([100, 190]);
        expect(data.date.top(Infinity).every((d) => d.total < 190)).toBe(true);
      } finally {
        data.total.filterAll();
      }
    });
  });

  describe("filterAll", () => {
    it("clears the filter", () => {
      data.total.filterRange([100, 200]);
      expect(data.date.top(Infinity).length).toBeLessThan(43);
      data.total.filterAll();
      expect(data.date.top(Infinity).length).toBe(43);
    });
  });

  describe("filterFunction", () => {
    it("selects records according to an arbitrary function", () => {
      try {
        data.total.filterFunction((d) => Boolean(d % 2));
        expect(data.date.top(Infinity).every((d) => d.total % 2)).toBe(true);
      } finally {
        data.total.filterAll();
      }
    });

    it("respects truthy values", () => {
      try {
        const group = data.quantity.groupAll().reduceCount();
        data.total.filterRange([200, Infinity]);
        data.total.filterFunction(() => Boolean("0"));
        expect(group.value()).toBe(43);
        data.total.filterFunction(() => Boolean(""));
        expect(group.value()).toBe(0);
      } finally {
        data.total.filterAll();
      }
    });

    it("groups on the first dimension are updated correctly", () => {
      try {
        const group = data.date.groupAll().reduceCount();
        data.total.filterFunction((d) => d === 90);
        expect(group.value()).toBe(13);
        data.total.filterFunction((d) => d === 91);
        expect(group.value()).toBe(1);
      } finally {
        data.total.filterAll();
      }
    });

    it("followed by filterRange", () => {
      try {
        data.total.filterFunction((d) => Boolean(d % 2));
        data.total.filterRange([100, 200]);
        expect(data.date.top(Infinity).length).toStrictEqual(19);
      } finally {
        data.total.filterAll();
      }
    });
  });

  describe("filter", () => {
    it("is equivalent to filterRange when passed an array", () => {
      try {
        data.total.filter([100, 190]);
        expect(data.date.top(Infinity).every((d) => d.total >= 100)).toBe(true);
      } finally {
        data.total.filter(null);
      }
    });

    it("is equivalent to filterExact when passed a single value", () => {
      try {
        data.total.filter(100);
        expect(data.date.top(Infinity).every((d) => d.total === 100)).toBe(true);
      } finally {
        data.total.filter(null);
      }
    });

    it("is equivalent to filterFunction when passed a function", () => {
      try {
        data.total.filter((d) => Boolean(d % 2));
        expect(data.date.top(Infinity).every((d) => d.total % 2)).toBe(true);
      } finally {
        data.total.filter(null);
      }
    });

    it("is equivalent to filterAll when passed null", () => {
      data.total.filter([100, 200]);
      expect(data.date.top(Infinity).length).toBeLessThan(43);
      data.total.filter(null);
      expect(data.date.top(Infinity).length).toBe(43);
    });
  });

  describe("currentFilter/hasCurrentFilter", () => {
    it("reflect the currently applied filter", () => {
      try {
        const exactFilter = 2;
        data.quantity.filterExact(exactFilter);
        expect(data.quantity.currentFilter()).toBe(exactFilter);
        expect(data.quantity.hasCurrentFilter()).toBeTruthy();

        const rangeFilter: [number, number] = [2, 3];
        data.quantity.filterRange(rangeFilter);
        expect(data.quantity.currentFilter()).toBe(rangeFilter);
        expect(data.quantity.hasCurrentFilter()).toBeTruthy();

        const functionFilter = (d: number) => d === 1;
        data.quantity.filterFunction(functionFilter);
        expect(data.quantity.currentFilter()).toBe(functionFilter);
        expect(data.quantity.hasCurrentFilter()).toBeTruthy();

        data.quantity.filterAll();
        expect(data.quantity.currentFilter()).toBeUndefined();
        expect(data.quantity.hasCurrentFilter()).toBe(false);

        data.quantity.filterExact(0);
        expect(data.quantity.currentFilter()).toBe(0);
        expect(data.quantity.hasCurrentFilter()).toBeTruthy();

        data.quantity.filterExact(null);
        expect(data.quantity.currentFilter()).toBeNull();
        expect(data.quantity.hasCurrentFilter()).toBeTruthy();

        data.quantity.filterExact(undefined);
        expect(data.quantity.currentFilter()).toBeUndefined();
        expect(data.quantity.hasCurrentFilter()).toBeTruthy();

        const multiFilter = 1;
        const tagsFilter = 3;
        data.quantity.filterExact(multiFilter);
        data.tags.filterExact(tagsFilter);
        expect(data.quantity.currentFilter()).toBe(multiFilter);
        expect(data.quantity.hasCurrentFilter()).toBeTruthy();
        expect(data.tags.currentFilter()).toBe(tagsFilter);
        expect(data.tags.hasCurrentFilter()).toBeTruthy();
        expect(data.total.currentFilter()).toBeUndefined();
        expect(data.total.hasCurrentFilter()).toBe(false);
      } finally {
        data.quantity.filterAll();
        data.tags.filterAll();
      }
    });
  });

  describe("groupAll (count, the default)", () => {
    let count: GroupAll<Sale, number>;

    beforeEach(() => {
      count = data.quantity.groupAll();
    });

    it("does not have top and order methods", () => {
      expect("top" in count).toBe(false);
      expect("order" in count).toBe(false);
    });

    describe("reduce", () => {
      it("reduces by add, remove, and initial", () => {
        try {
          count.reduce(
            (p, v) => p + v.total,
            (p, v) => p - v.total,
            () => 0,
          );
          expect(count.value()).toBe(6660);
        } finally {
          count.reduceCount();
        }
      });
    });

    describe("reduceCount", () => {
      it("reduces by count", () => {
        count.reduceSum((d) => d.total);
        expect(count.value()).toBe(6660);
        count.reduceCount();
        expect(count.value()).toBe(43);
      });
    });

    describe("reduceSum", () => {
      it("reduces by sum of accessor function", () => {
        try {
          count.reduceSum((d) => d.total);
          expect(count.value()).toBe(6660);
          count.reduceSum(() => 1);
          expect(count.value()).toBe(43);
        } finally {
          count.reduceCount();
        }
      });
    });

    describe("value", () => {
      it("returns the count of matching records", () => {
        expect(count.value()).toBe(43);
      });

      it("does not observe the associated dimension's filters", () => {
        try {
          data.quantity.filterRange([100, 200]);
          expect(count.value()).toBe(43);
        } finally {
          data.quantity.filterAll();
        }
      });

      it("observes other dimensions' filters", () => {
        try {
          data.type.filterExact("tab");
          expect(count.value()).toBe(32);
          data.type.filterExact("visa");
          expect(count.value()).toBe(7);
          data.tip.filterExact(100);
          expect(count.value()).toBe(5);
        } finally {
          data.type.filterAll();
          data.tip.filterAll();
        }
      });
    });

    describe("dispose", () => {
      it("detaches from reduce listeners", () => {
        const data = crossfilter([0, 1, 2]);
        let callback = false;
        const dimension = data.dimension((d) => d);
        const other = data.dimension((d) => d);
        const all = dimension.groupAll().reduce(
          () => {
            callback = true;
          },
          () => {
            callback = true;
          },
          () => {},
        );
        all.value();
        callback = false;
        all.dispose();
        other.filterRange([1, 2]);
        expect(callback).toBe(false);
      });

      it("detaches from add listeners", () => {
        const data = crossfilter([0, 1, 2]);
        let callback = false;
        const dimension = data.dimension((d) => d);
        const all = dimension.groupAll().reduce(
          () => {
            callback = true;
          },
          () => {
            callback = true;
          },
          () => {},
        );
        all.value();
        callback = false;
        all.dispose();
        data.add([3, 4, 5]);
        expect(callback).toBe(false);
      });
    });
  });

  describe("groupAll (sum of total)", () => {
    let total: GroupAll<Sale, number>;

    beforeEach(() => {
      total = data.quantity.groupAll().reduceSum((d) => d.total);
    });

    it("does not have top and order methods", () => {
      expect("top" in total).toBe(false);
      expect("order" in total).toBe(false);
    });

    describe("reduce", () => {
      it("determines the computed reduce value", () => {
        try {
          total.reduce(
            (p) => p + 1,
            (p) => p - 1,
            () => 0,
          );
          expect(total.value()).toBe(43);
        } finally {
          total.reduceSum((d) => d.total);
        }
      });
    });

    describe("value", () => {
      it("returns the sum total of matching records", () => {
        expect(total.value()).toBe(6660);
      });

      it("does not observe the associated dimension's filters", () => {
        try {
          data.quantity.filterRange([100, 200]);
          expect(total.value()).toBe(6660);
        } finally {
          data.quantity.filterAll();
        }
      });

      it("observes other dimensions' filters", () => {
        try {
          data.type.filterExact("tab");
          expect(total.value()).toBe(4760);
          data.type.filterExact("visa");
          expect(total.value()).toBe(1400);
          data.tip.filterExact(100);
          expect(total.value()).toBe(1000);
        } finally {
          data.type.filterAll();
          data.tip.filterAll();
        }
      });
    });
  });

  describe("group", () => {
    let hours: Group<Sale, Date, number>;
    let types: Group<Sale, string, number>;

    beforeEach(() => {
      hours = data.date.group((d) => {
        d = new Date(+d);
        d.setHours(d.getHours(), 0, 0, 0);
        return d;
      });
      types = data.type.group();
    });

    it("key defaults to value", () => {
      expect(types.top(Infinity)).toStrictEqual([
        { key: "tab", value: 32 },
        { key: "visa", value: 7 },
        { key: "cash", value: 4 },
      ]);
    });

    it("cardinality may be greater than 256", () => {
      const data = crossfilter(range(0, 256).concat(256, 256));
      const index = data.dimension((d) => d);
      const indexes = index.group();
      expect(index.top(2)).toStrictEqual([256, 256]);
      expect(indexes.top(1)).toStrictEqual([{ key: 256, value: 2 }]);
      expect(indexes.size()).toBe(257);
    });

    it("cardinality may be greater than 65536", () => {
      const data = crossfilter(range(0, 65536).concat(65536, 65536));
      const index = data.dimension((d) => d);
      const indexes = index.group();
      expect(index.top(2)).toStrictEqual([65536, 65536]);
      expect(indexes.top(1)).toStrictEqual([{ key: 65536, value: 2 }]);
      expect(indexes.size()).toBe(65537);
    });

    it("adds all records before removing filtered", () => {
      try {
        data.quantity.filter(1);
        const addGroup = data.type.group().reduce(
          (p) => {
            ++p;
            return p;
          },
          (p) => p,
          () => 0,
        );
        const stdGroup = data.type.group();
        expect(addGroup.top(1)[0].value > stdGroup.top(1)[0].value).toBe(true);
      } finally {
        data.quantity.filterAll();
      }
    });

    describe("size", () => {
      it("returns the cardinality", () => {
        expect(hours.size()).toBe(8);
        expect(types.size()).toBe(3);
      });

      it("ignores any filters", () => {
        try {
          data.type.filterExact("tab");
          data.quantity.filterRange([100, 200]);
          expect(hours.size()).toBe(8);
          expect(types.size()).toBe(3);
        } finally {
          data.quantity.filterAll();
          data.type.filterAll();
        }
      });
    });

    describe("reduce", () => {
      it("defaults to count", () => {
        expect(hours.top(1)).toStrictEqual([
          { key: new Date(Date.UTC(2011, 10, 14, 17, 0, 0)), value: 9 },
        ]);
      });

      it("determines the computed reduce value", () => {
        try {
          hours.reduceSum((d) => d.total);
          expect(hours.top(1)).toStrictEqual([
            { key: new Date(Date.UTC(2011, 10, 14, 17, 0, 0)), value: 1240 },
          ]);
        } finally {
          hours.reduceCount();
        }
      });

      describe("gives reduce functions information on lifecycle of data element", () => {
        let data: Crossfilter<{ foo: number; val: number }>;
        let foo: Dimension<{ foo: number; val: number }, number>;
        let val: Dimension<{ foo: number; val: number }, number>;
        let groupMax: Group<{ foo: number; val: number }, number, number>;
        let groupSum: Group<{ foo: number; val: number }, number, number>;

        beforeEach(() => {
          data = crossfilter<{ foo: number; val: number }>();
          data.add([
            { foo: 1, val: 2 },
            { foo: 2, val: 2 },
            { foo: 3, val: 2 },
            { foo: 3, val: 2 },
          ]);
          foo = data.dimension((d) => d.foo);
          val = data.dimension((d) => d.val);
          const bar = data.dimension((d) => d.foo);
          groupMax = bar.group().reduce(
            (p, v, n) => {
              if (n) {
                p += v.val;
              }
              return p;
            },
            (p, v, n) => {
              if (n) {
                p -= v.val;
              }
              return p;
            },
            () => 0,
          );
          groupSum = bar.group().reduceSum((d) => d.val);
        });

        it("on group creation", () => {
          expect(groupMax.all()).toStrictEqual(groupSum.all());
        });

        it("on filtering", () => {
          foo.filterRange([1, 3]);
          expect(groupMax.all()).toStrictEqual([
            { key: 1, value: 2 },
            { key: 2, value: 2 },
            { key: 3, value: 4 },
          ]);
          expect(groupSum.all()).toStrictEqual([
            { key: 1, value: 2 },
            { key: 2, value: 2 },
            { key: 3, value: 0 },
          ]);
          foo.filterAll();
        });

        it("on adding data after group creation", () => {
          data.add([{ foo: 1, val: 2 }]);
          expect(groupMax.all()).toStrictEqual(groupSum.all());
        });

        it("on adding data when a filter is in place", () => {
          data.add([{ foo: 1, val: 2 }]);
          foo.filterRange([1, 3]);
          data.add([{ foo: 3, val: 1 }]);
          expect(groupMax.all()).toStrictEqual([
            { key: 1, value: 4 },
            { key: 2, value: 2 },
            { key: 3, value: 5 },
          ]);
          expect(groupSum.all()).toStrictEqual([
            { key: 1, value: 4 },
            { key: 2, value: 2 },
            { key: 3, value: 0 },
          ]);
          foo.filterAll();
        });

        it("on removing data after group creation", () => {
          data.add([{ foo: 1, val: 2 }]);
          foo.filterRange([1, 3]);
          data.add([{ foo: 3, val: 1 }]);
          foo.filterAll();
          val.filter(1);
          data.remove();
          expect(groupMax.all()).toStrictEqual([
            { key: 1, value: 4 },
            { key: 2, value: 2 },
            { key: 3, value: 4 },
          ]);
          expect(groupSum.all()).toStrictEqual([
            { key: 1, value: 0 },
            { key: 2, value: 0 },
            { key: 3, value: 0 },
          ]);

          val.filterAll();
          expect(groupMax.all()).toStrictEqual(groupSum.all());
        });
      });
    });

    describe("top", () => {
      it("returns the top k groups by reduce value, in descending order", () => {
        expect(hours.top(3)).toStrictEqual([
          { key: new Date(Date.UTC(2011, 10, 14, 17, 0, 0)), value: 9 },
          { key: new Date(Date.UTC(2011, 10, 14, 16, 0, 0)), value: 7 },
          { key: new Date(Date.UTC(2011, 10, 14, 21, 0, 0)), value: 6 },
        ]);
      });

      it("observes the specified order", () => {
        try {
          hours.order((v) => -v);
          expect(hours.top(3)).toStrictEqual([
            { key: new Date(Date.UTC(2011, 10, 14, 20, 0, 0)), value: 2 },
            { key: new Date(Date.UTC(2011, 10, 14, 19, 0, 0)), value: 3 },
            { key: new Date(Date.UTC(2011, 10, 14, 18, 0, 0)), value: 5 },
          ]);
        } finally {
          hours.order((v) => v);
        }
      });

      it("works correctly on removing and adding back data with array groups", () => {
        const data = crossfilter<{ tags: string[] }>();
        const dimension = data.dimension((d) => d.tags, true);
        const group = dimension.group();
        data.add([{ tags: ["A"] }, { tags: ["B"] }]);
        data.remove((record) => record.tags.indexOf("A") !== -1);
        data.add([{ tags: ["A"] }, { tags: ["A"] }]);
        expect(group.top(Infinity)).toStrictEqual([
          { key: "A", value: 2 },
          { key: "B", value: 1 },
        ]);
      });

      it("works correctly on removing and adding back data with array groups 2", () => {
        const data = crossfilter<{ id: string; tags: string[] }>();
        const dimension = data.dimension((e) => e.tags, true);
        const group = dimension.group();

        const data1 = [
          { id: "0", tags: ["A", "B"] },
          { id: "1", tags: ["C"] },
        ];
        data.add(data1);

        data.remove((e) => e.id === "0");

        const data2 = [{ id: "0", tags: ["A", "B"] }];
        data.add(data2);
        expect(group.top(Infinity)).toStrictEqual([
          { key: "B", value: 1 },
          { key: "C", value: 1 },
          { key: "A", value: 1 },
        ]);
      });
    });

    describe("order", () => {
      it("defaults to the identity function", () => {
        expect(hours.top(1)).toStrictEqual([
          { key: new Date(Date.UTC(2011, 10, 14, 17, 0, 0)), value: 9 },
        ]);
      });

      it("is useful in conjunction with a compound reduce value", () => {
        try {
          hours
            .reduce(
              (p, v) => {
                ++p.count;
                p.total += v.total;
                return p;
              },
              (p, v) => {
                --p.count;
                p.total -= v.total;
                return p;
              },
              () => ({ count: 0, total: 0 }),
            )
            .order((v) => v.total);
          expect(hours.top(1)).toStrictEqual([
            {
              key: new Date(Date.UTC(2011, 10, 14, 17, 0, 0)),
              value: { count: 9, total: 1240 },
            },
          ]);
        } finally {
          hours.reduceCount().orderNatural();
        }
      });
    });

    describe("dispose", () => {
      it("detaches from reduce listeners", () => {
        const data = crossfilter([0, 1, 2]);
        let callback = false;
        const dimension = data.dimension((d) => d);
        const other = data.dimension((d) => d);
        const group = dimension.group((d) => d).reduce(
          () => {
            callback = true;
          },
          () => {
            callback = true;
          },
          () => {},
        );
        group.all();
        callback = false;
        group.dispose();
        other.filterRange([1, 2]);
        expect(callback).toBe(false);
      });

      it("detaches from add listeners", () => {
        const data = crossfilter([0, 1, 2]);
        let callback = false;
        const dimension = data.dimension((d) => d);
        const group = dimension.group((d) => d).reduce(
          () => {
            callback = true;
          },
          () => {
            callback = true;
          },
          () => {},
        );
        group.all();
        callback = false;
        group.dispose();
        data.add([3, 4, 5]);
        expect(callback).toBe(false);
      });

      it("removes reference to group from dimension", () => {
        const data = crossfilter([0, 1, 2]);
        const dimension = data.dimension((d) => d);
        const group = dimension.group((d) => d);
        const dispose = vi.spyOn(group, "dispose");

        group.dispose();
        dimension.dispose();

        expect(dispose).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("dispose", () => {
    it("detaches from add listeners", () => {
      const data = crossfilter([0, 1, 2]);
      let callback = false;
      const dimension = data.dimension((d) => {
        callback = true;
        return d;
      });
      callback = false;
      dimension.dispose();
      data.add([3, 4, 5]);
      expect(callback).toBe(false);
    });

    it("detaches groups from reduce listeners", () => {
      const data = crossfilter([0, 1, 2]);
      let callback = false;
      const dimension = data.dimension((d) => d);
      const other = data.dimension((d) => d);
      const group = dimension.group((d) => d).reduce(
        () => {
          callback = true;
        },
        () => {
          callback = true;
        },
        () => {},
      );
      group.all();
      callback = false;
      dimension.dispose();
      other.filterRange([1, 2]);
      expect(callback).toBe(false);
    });

    it("detaches groups from add listeners", () => {
      const data = crossfilter([0, 1, 2]);
      let callback = false;
      const dimension = data.dimension((d) => d);
      const group = dimension.group((d) => d).reduce(
        () => {
          callback = true;
        },
        () => {
          callback = true;
        },
        () => {},
      );
      group.all();
      callback = false;
      dimension.dispose();
      data.add([3, 4, 5]);
      expect(callback).toBe(false);
    });

    it("clears dimension filters from groups", () => {
      const data = crossfilter([0, 0, 2, 2]);
      const d1 = data.dimension((d) => -d);
      const d2 = data.dimension((d) => +d);
      const g2 = d2.group((d) => Math.round(d / 2) * 2);
      d1.filterRange([-1, 1]);
      d1.dispose();
      expect(g2.all()).toStrictEqual([
        { key: 0, value: 2 },
        { key: 2, value: 2 },
      ]);
    });
  });
});

describe("iterable dimension accessors", () => {
  it("accepts Int32Array values", () => {
    const values = Int32Array.of(1, 2);
    const records = [{ values }];
    const source = crossfilter(records);
    const accessor = (record: (typeof records)[number]) => record.values;
    const dimension = source.dimension(accessor, true);
    expect(dimension.accessor).toBe(accessor);
    expect(dimension.groupAll().value()).toBe(2);
    expect(dimension.filterExact(values[0]).bottom(Infinity)).toEqual(records);
  });

  it("accepts Object values", () => {
    const values = { 0: 1, 1: 2, length: 2 };
    const records = [{ values }];
    const source = crossfilter(records);
    const accessor = (record: (typeof records)[number]) => record.values;
    const dimension = source.dimension(accessor, true);
    expect(dimension.accessor).toBe(accessor);
    expect(dimension.groupAll().value()).toBe(2);
    expect(dimension.filterExact(values[0]).bottom(Infinity)).toEqual(records);
  });

  it("accepts String values", () => {
    const values = "12";
    const records = [{ values }];
    const source = crossfilter(records);
    const accessor = (record: (typeof records)[number]) => record.values;
    const dimension = source.dimension(accessor, true);
    expect(dimension.accessor).toBe(accessor);
    expect(dimension.groupAll().value()).toBe(2);
    expect(dimension.filterExact(values[0]).bottom(Infinity)).toEqual(records);
  });
});
