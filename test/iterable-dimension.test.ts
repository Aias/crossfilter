import { beforeEach, describe, expect, it } from "vitest";
import crossfilter from "../index.ts";
import type { Group } from "../index.ts";
import { createFixture } from "./fixtures.ts";
import type { Fixture, Sale } from "./fixtures.ts";

const range = (start: number, stop: number) =>
  Array.from({ length: stop - start }, (_, i) => start + i);

interface TaggedRecord {
  name: string;
  quantity: number;
  tags: number[];
}

const createTaggedCrossfilter = () => {
  const instance = crossfilter<TaggedRecord>();
  return Object.assign(instance, {
    tags: instance.dimension((d) => d.tags, true),
    quantity: instance.dimension((d) => d.quantity),
  });
};

const createTaggedCrossfilterWithGroup = () => {
  const data = createTaggedCrossfilter();
  return Object.assign(data, { tagGroup: data.tags.group() });
};

describe("iterablesEmptyRows", () => {
  interface EmptyRowsRecord {
    name: string;
    labels: string[];
  }

  const createEmptyRowsData = () => {
    const emptyRowsTestData: EmptyRowsRecord[] = [
      { name: "apha", labels: [] },
      { name: "bravo", labels: [] },
      { name: "charle", labels: [] },
      { name: "delta", labels: [] },
      { name: "echo", labels: ["courageous"] },
    ];
    const instance = crossfilter(emptyRowsTestData);
    return Object.assign(instance, {
      labels: instance.dimension((d) => d.labels, true),
    });
  };

  let data: ReturnType<typeof createEmptyRowsData>;

  beforeEach(() => {
    data = createEmptyRowsData();
  });

  describe("top", () => {
    it("returns the top k records by value, placing non-empty row on top", () => {
      expect(data.labels.top(5)).toStrictEqual([
        { name: "echo", labels: ["courageous"] },
        { name: "apha", labels: [] },
        { name: "bravo", labels: [] },
        { name: "charle", labels: [] },
        { name: "delta", labels: [] },
      ]);
    });

    it("returns the top k records, using offset, by value", () => {
      expect(data.labels.top(3, 2)).toStrictEqual([
        { name: "bravo", labels: [] },
        { name: "charle", labels: [] },
        { name: "delta", labels: [] },
      ]);
    });
  });

  describe("bottom", () => {
    it("returns the bottom k records by value, placing non-empty row on bottom", () => {
      expect(data.labels.bottom(5)).toStrictEqual([
        { name: "apha", labels: [] },
        { name: "bravo", labels: [] },
        { name: "charle", labels: [] },
        { name: "delta", labels: [] },
        { name: "echo", labels: ["courageous"] },
      ]);
    });

    it("returns the bottom k records, using offset, by value, in descending order", () => {
      expect(data.labels.bottom(3, 2)).toStrictEqual([
        { name: "charle", labels: [] },
        { name: "delta", labels: [] },
        { name: "echo", labels: ["courageous"] },
      ]);
    });
  });
  describe("filtering", () => {
    it("excludes empty records added while a filter is active", () => {
      data.labels.filterExact("courageous");
      data.add([{ name: "foxtrot", labels: [] }]);
      expect(data.allFiltered()).toStrictEqual([{ name: "echo", labels: ["courageous"] }]);
      data.labels.filterAll();
      expect(data.allFiltered()).toHaveLength(6);
    });

    it("lists a record once per value that passes a predicate filter", () => {
      const tagged = crossfilter([{ tags: [1, 2, 3] }, { tags: [2] }, { tags: [4] }]);
      const tags = tagged.dimension((record) => record.tags, true);
      tags.filterFunction((tag) => tag % 2 === 0);
      expect(tags.top(Infinity)).toStrictEqual([{ tags: [4] }, { tags: [1, 2, 3] }, { tags: [2] }]);
      expect(tags.bottom(Infinity)).toStrictEqual([{ tags: [1, 2, 3] }, { tags: [2] }, { tags: [4] }]);
    });

    it("keeps empty records excluded when a predicate filter becomes a range filter", () => {
      data.labels.filterFunction((label) => label.length > 0);
      data.labels.filterRange(["a", "d"]);
      expect(data.allFiltered()).toStrictEqual([{ name: "echo", labels: ["courageous"] }]);
    });
  });
});

describe("iterableDimension", () => {
  let data: Fixture;

  beforeEach(() => {
    data = createFixture();
  });

  describe("top", () => {
    it("returns the top k records by value, in descending order", () => {
      const top = data.tags.top(3);
      expect(top.length).toBe(3);
      expect(Math.max(...top[0].tags)).toBe(5);
      expect(Math.max(...top[1].tags)).toBe(5);
      expect(Math.max(...top[2].tags)).toBe(5);
    });

    it("observes the associated dimension's filters", () => {
      try {
        data.tags.filterExact(1);
        const top = data.tags.top(3);
        expect(top[0].tags.indexOf(1) > -1).toBe(true);
        expect(top[1].tags.indexOf(1) > -1).toBe(true);
        expect(top[2].tags.indexOf(1) > -1).toBe(true);
      } finally {
        data.tags.filterAll();
      }
    });

    it("observes other dimensions' filters", () => {
      try {
        data.quantity.filterExact(4);
        expect(data.tags.top(1)).toStrictEqual([
          {
            date: "2011-11-14T21:18:48Z",
            quantity: 4,
            total: 270,
            tip: 0,
            type: "tab",
            tags: [1, 2, 3],
          },
        ]);
        data.quantity.filterAll();
        data.type.filterExact("visa");
        expect(data.tags.top(1)).toStrictEqual([
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
        expect(data.tags.top(1)).toStrictEqual([
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
      expect(data.tags.top(0)).toStrictEqual([]);
      expect(data.tags.top(-1)).toStrictEqual([]);
      expect(data.tags.top(NaN)).toStrictEqual([]);
      expect(data.tags.top(-Infinity)).toStrictEqual([]);
    });
  });

  describe("bottom", () => {
    it("returns the bottom k records by value, in descending order", () => {
      const bottom = data.tags.bottom(3);
      expect(bottom[0].tags.length).toBe(0);
      expect(bottom[1].tags[0]).toBe(-1);
      expect(bottom[2].tags[1]).toBe(0);
    });

    it("observes the associated dimension's filters", () => {
      try {
        data.quantity.filterExact(4);
        expect(data.tags.bottom(3)).toStrictEqual([
          {
            date: "2011-11-14T21:18:48Z",
            quantity: 4,
            total: 270,
            tip: 0,
            type: "tab",
            tags: [1, 2, 3],
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
        expect(data.tags.bottom(10)).toStrictEqual([
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
        expect(data.tags.bottom(2)).toStrictEqual([
          {
            date: "2011-11-14T17:22:59Z",
            quantity: 2,
            total: 90,
            tip: 0,
            type: "tab",
            tags: [],
          },
          {
            date: "2011-11-14T16:17:54Z",
            quantity: 2,
            total: 190,
            tip: 100,
            type: "tab",
            tags: [1, 2, 3],
          },
        ]);
        data.type.filterExact("visa");
        expect(data.tags.bottom(1)).toStrictEqual([
          {
            date: "2011-11-14T17:29:52Z",
            quantity: 1,
            total: 200,
            tip: 100,
            type: "visa",
            tags: [-1, 0, 3, 4],
          },
        ]);
        data.quantity.filterExact(2);
        expect(data.tags.bottom(1)).toStrictEqual([
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
      expect(data.tags.bottom(0)).toStrictEqual([]);
      expect(data.tags.bottom(-1)).toStrictEqual([]);
      expect(data.tags.bottom(NaN)).toStrictEqual([]);
      expect(data.tags.bottom(-Infinity)).toStrictEqual([]);
    });
  });

  describe("filterExact", () => {
    it("selects records that match the specified value exactly", () => {
      try {
        data.tip.filterExact(100);
        expect(data.tags.top(2)).toStrictEqual([
          {
            date: "2011-11-14T23:21:22Z",
            quantity: 2,
            total: 190,
            tip: 100,
            type: "tab",
            tags: [2, 4, 5],
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
      } finally {
        data.tip.filterAll();
      }
    });

    it("allows the filter value to be null, equivalent to 0 by natural ordering", () => {
      try {
        data.tip.filterExact(null);
        expect(data.tags.top(2)).toStrictEqual([
          {
            date: "2011-11-14T22:48:05Z",
            quantity: 2,
            total: 91,
            tip: 0,
            type: "tab",
            tags: [2, 4, 5],
          },
          {
            date: "2011-11-14T20:06:33Z",
            quantity: 1,
            total: 100,
            tip: null,
            type: "cash",
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
        expect(data.tags.top(Infinity).every((d) => d.total >= 100)).toBe(true);
        data.total.filterRange([110, 190]);
        expect(data.tags.top(Infinity).every((d) => d.total >= 110)).toBe(true);
      } finally {
        data.total.filterAll();
      }
    });

    it("selects records less than the exclusive lower bound", () => {
      try {
        data.total.filterRange([100, 200]);
        expect(data.tags.top(Infinity).every((d) => d.total < 200)).toBe(true);
        data.total.filterRange([100, 190]);
        expect(data.tags.top(Infinity).every((d) => d.total < 190)).toBe(true);
      } finally {
        data.total.filterAll();
      }
    });
  });

  describe("filterAll", () => {
    it("clears the filter", () => {
      data.total.filterRange([100, 200]);
      expect(data.tags.top(Infinity).length).toBeLessThan(120);
      data.total.filterAll();
      expect(data.tags.top(Infinity).length).toBe(120);
    });
  });

  describe("filterFunction", () => {
    it("selects records according to an arbitrary function", () => {
      try {
        data.total.filterFunction((d) => Boolean(d % 2));
        expect(data.tags.top(Infinity).every((d) => d.total % 2)).toBe(true);
      } finally {
        data.total.filterAll();
      }
    });

    it("respects truthy values", () => {
      try {
        const group = data.tags.groupAll().reduceCount();
        data.total.filterRange([200, Infinity]);
        data.total.filterFunction(() => Boolean("0"));
        expect(group.value()).toBe(119);
        data.total.filterFunction(() => Boolean(""));
        expect(group.value()).toBe(0);
      } finally {
        data.total.filterAll();
      }
    });

    it("groups on the first dimension are updated correctly", () => {
      try {
        const group = data.tags.groupAll().reduceCount();
        data.total.filterFunction((d) => d === 90);
        expect(group.value()).toBe(33);
        data.total.filterFunction((d) => d === 91);
        expect(group.value()).toBe(3);
      } finally {
        data.total.filterAll();
      }
    });

    it("followed by filterRange", () => {
      try {
        data.total.filterFunction((d) => Boolean(d % 2));
        data.total.filterRange([100, 200]);
        expect(data.tags.top(Infinity).length).toStrictEqual(54);
      } finally {
        data.total.filterAll();
      }
    });

    it("group values with multiple filters on and off on standard dimension", () => {
      try {
        const group = data.tags.group();
        data.total.filterFunction((d) => d === 90);
        expect(group.all()[group.all().length - 1].value).toBe(1);
        data.total.filterAll();
        data.total.filterFunction((d) => d === 91);
        expect(group.all()[group.all().length - 1].value).toBe(1);
        data.total.filterAll();
        expect(group.all()[group.all().length - 1].value).toBe(13);
      } finally {
        data.total.filterAll();
      }
    });

    it("group values with multiple filters on and off on iterable dimension", () => {
      try {
        const group = data.total.groupAll().reduceCount();
        expect(group.value()).toBe(43);
        data.tags.filterFunction((d) => d === 1);
        expect(group.value()).toBe(18);
        data.tags.filterAll();
        expect(group.value()).toBe(43);
        data.tags.filterFunction((d) => d === 1);
        expect(group.value()).toBe(18);
        data.tags.filterAll();
        expect(group.value()).toBe(43);
      } finally {
        data.tags.filterAll();
      }
    });

    it("group values with multiple overlapping filters", () => {
      try {
        const group = data.total.groupAll().reduceCount();
        expect(group.value()).toBe(43);
        data.tags.filterFunction((d) => d === 1);
        expect(group.value()).toBe(18);
        data.tags.filterFunction((d) => d === 2);
        expect(group.value()).toBe(33);
        data.tags.filterAll();
        expect(group.value()).toBe(43);
      } finally {
        data.tags.filterAll();
      }
    });
  });

  describe("filter", () => {
    it("is equivalent to filterRange when passed an array", () => {
      try {
        data.total.filter([100, 190]);
        expect(data.tags.top(Infinity).every((d) => d.total >= 100)).toBe(true);
      } finally {
        data.total.filter(null);
      }
    });

    it("is equivalent to filterExact when passed a single value", () => {
      try {
        data.total.filter(100);
        expect(data.tags.top(Infinity).every((d) => d.total === 100)).toBe(true);
      } finally {
        data.total.filter(null);
      }
    });

    it("is equivalent to filterFunction when passed a function", () => {
      try {
        data.total.filter((d) => Boolean(d % 2));
        expect(data.tags.top(Infinity).every((d) => d.total % 2)).toBe(true);
      } finally {
        data.total.filter(null);
      }
    });

    it("is equivalent to filterAll when passed null", () => {
      data.total.filter([100, 200]);
      expect(data.tags.top(Infinity).length).toBeLessThan(120);
      data.total.filter(null);
      expect(data.tags.top(Infinity).length).toBe(120);
    });
  });

  describe("group", () => {
    let hours: Group<Sale, Date, number>;
    let tagsAll: Group<Sale, number, number>;

    beforeEach(() => {
      hours = data.date.group((value) => {
        const date = new Date(+value);
        date.setHours(date.getHours(), 0, 0, 0);
        return date;
      });
      tagsAll = data.tags.group();
    });

    const createCardinalityFixture = (size: number) => {
      const instance = crossfilter(
        range(0, size)
          .concat(size, size)
          .map((d) => ({ tags: [d, d + 1, d + 2] })),
      );
      const index = instance.dimension((d) => d.tags, true);
      return { index, indexes: index.group() };
    };

    it("key defaults to value", () => {
      expect(tagsAll.top(Infinity)).toStrictEqual([
        { key: 2, value: 33 },
        { key: 3, value: 29 },
        { key: 4, value: 24 },
        { key: 1, value: 18 },
        { key: 5, value: 13 },
        { key: 0, value: 1 },
        { key: -1, value: 1 },
      ]);
    });

    it("cardinality may be greater than 256", () => {
      const { index, indexes } = createCardinalityFixture(256);
      expect(index.top(2)).toStrictEqual([
        { tags: [256, 257, 258] },
        { tags: [256, 257, 258] },
      ]);
      expect(indexes.top(1)).toStrictEqual([{ key: 256, value: 4 }]);
      expect(indexes.size()).toBe(259);
    });

    it("cardinality may be greater than 65536", () => {
      const { index, indexes } = createCardinalityFixture(65536);
      expect(index.top(2)).toStrictEqual([
        { tags: [65536, 65537, 65538] },
        { tags: [65536, 65537, 65538] },
      ]);
      expect(indexes.top(1)).toStrictEqual([{ key: 65536, value: 4 }]);
      expect(indexes.size()).toBe(65539);
    });

    it("adds all records before removing filtered", () => {
      try {
        data.quantity.filter(1);
        const addGroup = data.tags.group().reduce(
          (p) => p + 1,
          (p) => p,
          () => 0,
        );
        const stdGroup = data.tags.group();
        expect(addGroup.top(1)[0].value > stdGroup.top(1)[0].value).toBe(true);
      } finally {
        data.quantity.filterAll();
      }
    });

    describe("size", () => {
      it("returns the cardinality", () => {
        expect(hours.size()).toBe(8);
        expect(tagsAll.size()).toBe(7);
      });

      it("ignores any filters", () => {
        try {
          data.tags.filterExact(1);
          data.quantity.filterRange([100, 200]);
          expect(hours.size()).toBe(8);
          expect(tagsAll.size()).toBe(7);
        } finally {
          data.quantity.filterAll();
          data.tags.filterAll();
        }
      });
    });

    describe("reduce", () => {
      it("defaults to count", () => {
        expect(tagsAll.top(1)).toStrictEqual([{ key: 2, value: 33 }]);
      });

      it("determines the computed reduce value", () => {
        try {
          tagsAll.reduceSum((d) => d.total);
          expect(tagsAll.top(Infinity)).toStrictEqual([
            { key: 2, value: 5241 },
            { key: 3, value: 4229 },
            { key: 4, value: 3861 },
            { key: 1, value: 2709 },
            { key: 5, value: 2341 },
            { key: 0, value: 200 },
            { key: -1, value: 200 },
          ]);
        } finally {
          tagsAll.reduceCount();
        }
      });

      describe("gives reduce functions information on lifecycle of data element", () => {
        interface LifecycleRecord {
          foo: number;
          val: number[];
        }

        const createLifecycleData = () => {
          const instance = crossfilter<LifecycleRecord>();
          instance.add([
            { foo: 1, val: [1, 2] },
            { foo: 2, val: [1, 2] },
            { foo: 3, val: [3, 4, 5] },
            { foo: 3, val: [1, 2] },
          ]);
          const foo = instance.dimension((d) => d.foo);
          instance.dimension((d) => d.foo);
          const val = instance.dimension((d) => d.val, true);
          const groupSumLength = val.group().reduce(
            (p, v, n) => {
              if (n) p += v.val.length;
              return p;
            },
            (p, v, n) => {
              if (n) p -= v.val.length;
              return p;
            },
            () => 0,
          );
          const groupSumEach = val.group().reduceSum((d) => d.val.length);
          return Object.assign(instance, { foo, val, groupSumLength, groupSumEach });
        };

        let data: ReturnType<typeof createLifecycleData>;

        beforeEach(() => {
          data = createLifecycleData();
        });

        it("on group creation", () => {
          expect(data.groupSumLength.all()).toStrictEqual(data.groupSumEach.all());
        });

        it("on filtering", () => {
          data.foo.filterRange([1, 2]);
          expect(data.groupSumLength.all()).toStrictEqual([
            { key: 1, value: 6 },
            { key: 2, value: 6 },
            { key: 3, value: 3 },
            { key: 4, value: 3 },
            { key: 5, value: 3 },
          ]);
          expect(data.groupSumEach.all()).toStrictEqual([
            { key: 1, value: 2 },
            { key: 2, value: 2 },
            { key: 3, value: 0 },
            { key: 4, value: 0 },
            { key: 5, value: 0 },
          ]);
          data.foo.filterAll();
        });

        it("on adding data after group creation", () => {
          data.add([{ foo: 1, val: [5, 6, 7] }]);
          expect(data.groupSumLength.all()).toStrictEqual(data.groupSumEach.all());
        });

        it("on adding data when a filter is in place", () => {
          data.add([{ foo: 1, val: [5, 6, 7] }]);
          data.foo.filterRange([1, 3]);
          data.add([{ foo: 3, val: [6] }]);
          expect(data.groupSumLength.all()).toStrictEqual([
            { key: 1, value: 6 },
            { key: 2, value: 6 },
            { key: 3, value: 3 },
            { key: 4, value: 3 },
            { key: 5, value: 6 },
            { key: 6, value: 4 },
            { key: 7, value: 3 },
          ]);
          expect(data.groupSumEach.all()).toStrictEqual([
            { key: 1, value: 4 },
            { key: 2, value: 4 },
            { key: 3, value: 0 },
            { key: 4, value: 0 },
            { key: 5, value: 3 },
            { key: 6, value: 3 },
            { key: 7, value: 3 },
          ]);
          data.foo.filterAll();
        });

        it("on removing data after group creation", () => {
          data.add([{ foo: 1, val: [5, 6, 7] }]);
          data.foo.filterRange([1, 3]);
          data.add([{ foo: 3, val: [6] }]);
          data.foo.filterAll();
          data.val.filter(2);
          data.remove();
          expect(data.groupSumLength.all()).toStrictEqual([
            { key: 3, value: 3 },
            { key: 4, value: 3 },
            { key: 5, value: 6 },
            { key: 6, value: 4 },
            { key: 7, value: 3 },
          ]);
          expect(data.groupSumEach.all()).toStrictEqual([
            { key: 3, value: 3 },
            { key: 4, value: 3 },
            { key: 5, value: 6 },
            { key: 6, value: 4 },
            { key: 7, value: 3 },
          ]);

          data.val.filterAll();
          expect(data.groupSumLength.all()).toStrictEqual(data.groupSumEach.all());
        });
      });
    });

    describe("top", () => {
      it("returns the top k groups by reduce value, in descending order", () => {
        expect(tagsAll.top(3)).toStrictEqual([
          { key: 2, value: 33 },
          { key: 3, value: 29 },
          { key: 4, value: 24 },
        ]);
      });

      it("observes the specified order", () => {
        try {
          tagsAll.order((v) => -v);
          expect(tagsAll.top(3)).toStrictEqual([
            { key: 0, value: 1 },
            { key: -1, value: 1 },
            { key: 5, value: 13 },
          ]);
        } finally {
          tagsAll.order((v) => v);
        }
      });
    });

    describe("order", () => {
      it("defaults to the identity function", () => {
        expect(tagsAll.top(1)).toStrictEqual([{ key: 2, value: 33 }]);
      });

      it("is useful in conjunction with a compound reduce value", () => {
        try {
          const compoundGroup = tagsAll
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
          expect(compoundGroup.top(1)).toStrictEqual([
            {
              key: 2,
              value: { count: 33, total: 5241 },
            },
          ]);
        } finally {
          tagsAll.reduceCount().orderNatural();
        }
      });
    });

    it("works for empty arrays in middle or end", () => {
      const data = crossfilter<{ tags: number[] }>([
        { tags: [1, 2, 3] },
        { tags: [] },
        { tags: [1, 2, 3] },
        { tags: [3] },
        { tags: [] },
      ]);
      const dimension = data.dimension((d) => d.tags, true);
      const group = dimension.group((d) => d);
      group.top(10);
    });

    describe("dispose", () => {
      it("detaches from reduce listeners", () => {
        const data = crossfilter<{ tags: number[] }>([
          { tags: [1, 2, 3] },
          { tags: [1, 2, 3] },
          { tags: [3] },
        ]);
        let callback = false;
        const dimension = data.dimension((d) => d.tags, true);
        const other = data.dimension((d) => d.tags, true);
        const group = dimension
          .group((d) => d)
          .reduce(
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
        const data = crossfilter<{ tags: number[] }>([
          { tags: [1, 2, 3] },
          { tags: [1, 2, 3] },
          { tags: [3] },
        ]);
        let callback = false;
        const dimension = data.dimension((d) => d.tags, true);
        const group = dimension
          .group((d) => d)
          .reduce(
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
        data.add([{ tags: [3] }, { tags: [4, 5] }, { tags: [4, 5, 6] }]);
        expect(callback).toBe(false);
      });
    });
  });
});

describe("iterable add", () => {
  let data: ReturnType<typeof createTaggedCrossfilter>;

  beforeEach(() => {
    const firstSet: TaggedRecord[] = [
      { name: "alpha", quantity: 1, tags: [1, 2] },
      { name: "bravo", quantity: 2, tags: [1] },
      { name: "charlie", quantity: 1, tags: [] },
    ];
    const secondSet: TaggedRecord[] = [
      { name: "delta", quantity: 0, tags: [2] },
      { name: "echo", quantity: 3, tags: [] },
    ];
    data = createTaggedCrossfilter();
    data.add(firstSet);
    data.add(secondSet);
  });

  describe("top", () => {
    it("returns the top k records by value, in descending order", () => {
      const top = data.tags.top(7);
      expect(top.length).toBe(6);
      expect(Math.max(...top[0].tags)).toBe(2);
      expect(Math.max(...top[1].tags)).toBe(2);
      expect(Math.min(...top[2].tags)).toBe(1);
      expect(Math.min(...top[3].tags)).toBe(1);
      expect(top[4].tags.length).toBe(0);
      expect(top[5].tags.length).toBe(0);
    });

    it("observes the associated dimension's filters", () => {
      try {
        data.tags.filterExact(2);
        const top = data.tags.top(3);
        expect(top.length).toBe(2);
        expect(top[0].tags.indexOf(2) > -1).toBe(true);
        expect(top[1].tags.indexOf(2) > -1).toBe(true);
      } finally {
        data.tags.filterAll();
      }
    });

    it("others observe the associated dimension's filters", () => {
      try {
        data.tags.filterExact(2);
        const top = data.quantity.top(3);
        expect(top.length).toBe(2);
        expect(top[0].tags.indexOf(2) > -1).toBe(true);
        expect(top[1].tags.indexOf(2) > -1).toBe(true);
      } finally {
        data.tags.filterAll();
      }
    });

    it("observes other dimensions' filters", () => {
      try {
        data.quantity.filterExact(1);
        const top = data.tags.top(4);
        expect(top.length).toBe(3);
        expect(top[0].name).toBe("alpha");
        expect(top[1].name).toBe("alpha");
        expect(top[2].name).toBe("charlie");
      } finally {
        data.quantity.filterAll();
      }
    });
  });

  describe("bottom", () => {
    it("returns the bottom k records by value, in descending order", () => {
      const bottom = data.tags.bottom(7);
      expect(bottom.length).toBe(6);
      expect(bottom[0].tags.length).toBe(0);
      expect(bottom[1].tags.length).toBe(0);
      expect(Math.min(...bottom[2].tags)).toBe(1);
      expect(Math.min(...bottom[3].tags)).toBe(1);
      expect(Math.max(...bottom[4].tags)).toBe(2);
      expect(Math.max(...bottom[5].tags)).toBe(2);
    });
  });

  describe("force order when adding", () => {
    let data: ReturnType<typeof createTaggedCrossfilter>;

    beforeEach(() => {
      const firstSet: TaggedRecord[] = [
        { name: "alpha", quantity: 1, tags: [1, 2] },
        { name: "bravo", quantity: 2, tags: [] },
      ];
      const secondSet: TaggedRecord[] = [
        { name: "charlie", quantity: 0, tags: [3, 4] },
        { name: "delta", quantity: 0, tags: [2, 3] },
        { name: "echo", quantity: 3, tags: [4, 5] },
      ];
      data = createTaggedCrossfilter();
      data.add(firstSet);
      data.add(secondSet);
    });

    it("others observe the associated dimension's filters", () => {
      try {
        data.tags.filterFunction((d) => d === 1);
        const top = data.quantity.top(2);
        expect(top.length).toBe(1);
        expect(top[0].tags.indexOf(1) > -1).toBe(true);
      } finally {
        data.tags.filterAll();
      }
    });

    it("observes other dimensions' filters", () => {
      try {
        data.quantity.filterFunction((d) => d === 1);
        const top = data.tags.top(3);
        expect(top.length).toBe(2);
        expect(top[0].name).toBe("alpha");
        expect(top[1].name).toBe("alpha");
      } finally {
        data.quantity.filterAll();
      }
    });
  });

  describe("group", () => {
    let data: ReturnType<typeof createTaggedCrossfilterWithGroup>;

    beforeEach(() => {
      const firstSet: TaggedRecord[] = [
        { name: "alpha", quantity: 1, tags: [1, 3] },
        { name: "bravo", quantity: 0, tags: [1, 3] },
      ];
      const secondSet: TaggedRecord[] = [
        { name: "charlie", quantity: 0, tags: [2] },
        { name: "delta", quantity: 2, tags: [2, 3] },
        { name: "echo", quantity: 2, tags: [4] },
      ];
      data = createTaggedCrossfilterWithGroup();
      data.add(firstSet);
      data.add(secondSet);
    });

    it("records added correctly", () => {
      const top = data.tagGroup.top(5);
      expect(top.length).toBe(4);
      expect(top[0].value).toBe(3);
      expect(top[1].value).toBe(2);
      expect(top[2].value).toBe(2);
      expect(top[3].value).toBe(1);
      expect(top[0].key).toBe(3);
      expect(top[3].key).toBe(4);
    });

    it("observes other dimensions' filters", () => {
      try {
        data.quantity.filterFunction((d) => d === 0);
        const top = data.tagGroup.top(5);
        expect(top.length).toBe(4);
        expect(top[0].value).toBe(1);
        expect(top[0].value).toBe(1);
        expect(top[1].value).toBe(1);
        expect(top[2].value).toBe(1);
        expect(top[3].value).toBe(0);
        expect(top[3].key).toBe(4);
      } finally {
        data.quantity.filterAll();
      }
    });

    it("one tag with one empty", () => {
      const set: TaggedRecord[] = [
        { name: "alpha", quantity: 2, tags: [1] },
        { name: "bravo", quantity: 1, tags: [] },
      ];
      const localData = createTaggedCrossfilterWithGroup();
      localData.add(set);
      expect(localData.tagGroup.all()).toStrictEqual([{ key: 1, value: 1 }]);
    });

    it("one tag then add empty", () => {
      const firstSet: TaggedRecord[] = [{ name: "alpha", quantity: 2, tags: [1] }];
      const secondSet: TaggedRecord[] = [{ name: "bravo", quantity: 1, tags: [] }];
      const localData = createTaggedCrossfilterWithGroup();
      localData.add(firstSet);
      localData.add(secondSet);
      expect(localData.tagGroup.all()).toStrictEqual([{ key: 1, value: 1 }]);
    });

    it("empty tag then add one tag", () => {
      const firstSet: TaggedRecord[] = [{ name: "alpha", quantity: 2, tags: [] }];
      const secondSet: TaggedRecord[] = [{ name: "bravo", quantity: 1, tags: [1] }];
      const localData = createTaggedCrossfilterWithGroup();
      localData.add(firstSet);
      localData.add(secondSet);
      expect(localData.tagGroup.all()).toStrictEqual([{ key: 1, value: 1 }]);
    });

    it("one tag then add one more tag", () => {
      const firstSet: TaggedRecord[] = [{ name: "alpha", quantity: 2, tags: [1] }];
      const secondSet: TaggedRecord[] = [{ name: "bravo", quantity: 1, tags: [2] }];
      const localData = createTaggedCrossfilterWithGroup();
      localData.add(firstSet);
      localData.add(secondSet);
      expect(localData.tagGroup.all()).toStrictEqual([
        { key: 1, value: 1 },
        { key: 2, value: 1 },
      ]);
    });
  });
});

describe("iterable remove", () => {
  describe("dimension", () => {
    it("other dimension filtered remove", () => {
      const set: TaggedRecord[] = [
        { name: "alpha", quantity: 1, tags: [1, 3] },
        { name: "bravo", quantity: 0, tags: [1, 3] },
        { name: "charlie", quantity: 3, tags: [2] },
        { name: "delta", quantity: 3, tags: [2, 3] },
        { name: "echo", quantity: 2, tags: [4] },
        { name: "foxtrot", quantity: 1, tags: [] },
      ];
      const data = createTaggedCrossfilter();
      data.add(set);
      data.quantity.filterExact(3);
      data.remove();
      data.quantity.filterAll();
      const top = data.tags.top(7);
      expect(top.length).toBe(6);
      expect(Math.max(...top[0].tags)).toBe(4);
      expect(Math.max(...top[1].tags)).toBe(3);
      expect(Math.min(...top[1].tags)).toBe(1);
      expect(Math.max(...top[2].tags)).toBe(3);
      expect(Math.min(...top[2].tags)).toBe(1);
      expect(Math.max(...top[3].tags)).toBe(3);
      expect(Math.min(...top[3].tags)).toBe(1);
      expect(Math.max(...top[4].tags)).toBe(3);
      expect(Math.min(...top[4].tags)).toBe(1);
      expect(top[5].tags.length).toBe(0);
    });

    it("self filterExact remove", () => {
      const set: TaggedRecord[] = [
        { name: "alpha", quantity: 1, tags: [1, 3] },
        { name: "bravo", quantity: 0, tags: [1, 3] },
        { name: "charlie", quantity: 3, tags: [2] },
        { name: "delta", quantity: 3, tags: [2, 3] },
        { name: "echo", quantity: 2, tags: [4] },
        { name: "foxtrot", quantity: 1, tags: [] },
      ];
      const data = createTaggedCrossfilter();
      data.add(set);
      data.tags.filterExact(2);
      data.remove();
      data.tags.filterAll();
      const top = data.tags.top(7);
      expect(top.length).toBe(6);
      expect(Math.max(...top[0].tags)).toBe(4);
      expect(Math.max(...top[1].tags)).toBe(3);
      expect(Math.min(...top[1].tags)).toBe(1);
      expect(Math.max(...top[2].tags)).toBe(3);
      expect(Math.min(...top[2].tags)).toBe(1);
      expect(Math.max(...top[3].tags)).toBe(3);
      expect(Math.min(...top[3].tags)).toBe(1);
      expect(Math.max(...top[4].tags)).toBe(3);
      expect(Math.min(...top[4].tags)).toBe(1);
      expect(top[5].tags.length).toBe(0);
    });

    it("self filterFunction remove", () => {
      const set: TaggedRecord[] = [
        { name: "alpha", quantity: 1, tags: [1, 3] },
        { name: "bravo", quantity: 0, tags: [1, 3] },
        { name: "charlie", quantity: 3, tags: [2] },
        { name: "delta", quantity: 3, tags: [2, 3] },
        { name: "echo", quantity: 2, tags: [4] },
        { name: "foxtrot", quantity: 1, tags: [] },
      ];
      const data = createTaggedCrossfilter();
      data.add(set);
      data.tags.filterFunction((d) => d === 2);
      data.remove();
      data.tags.filterAll();
      const top = data.tags.top(7);
      expect(top.length).toBe(6);
      expect(Math.max(...top[0].tags)).toBe(4);
      expect(Math.max(...top[1].tags)).toBe(3);
      expect(Math.min(...top[1].tags)).toBe(1);
      expect(Math.max(...top[2].tags)).toBe(3);
      expect(Math.min(...top[2].tags)).toBe(1);
      expect(Math.max(...top[3].tags)).toBe(3);
      expect(Math.min(...top[3].tags)).toBe(1);
      expect(Math.max(...top[4].tags)).toBe(3);
      expect(Math.min(...top[4].tags)).toBe(1);
      expect(top[5].tags.length).toBe(0);
    });

    it("other dimension filtered then self filterFunction remove", () => {
      const set: TaggedRecord[] = [
        { name: "alpha", quantity: 1, tags: [1, 3] },
        { name: "bravo", quantity: 0, tags: [1, 3] },
        { name: "charlie", quantity: 3, tags: [2] },
        { name: "delta", quantity: 3, tags: [2, 3] },
        { name: "echo", quantity: 2, tags: [4] },
        { name: "foxtrot", quantity: 1, tags: [] },
      ];
      const data = createTaggedCrossfilter();
      data.add(set);
      data.quantity.filterExact(3);
      data.remove();
      data.quantity.filterAll();
      data.tags.filterFunction((d) => d === 1);
      data.remove();
      data.tags.filterAll();
      expect(data.tags.top(3)).toStrictEqual([
        { name: "echo", quantity: 2, tags: [4] },
        { name: "foxtrot", quantity: 1, tags: [] },
      ]);
    });

    it("remove then add", () => {
      const firstSet: TaggedRecord[] = [
        { name: "alpha", quantity: 1, tags: [1, 3] },
        { name: "bravo", quantity: 0, tags: [1, 3] },
        { name: "charlie", quantity: 3, tags: [2] },
        { name: "delta", quantity: 3, tags: [2, 3] },
        { name: "echo", quantity: 2, tags: [4] },
        { name: "foxtrot", quantity: 1, tags: [] },
      ];
      const secondSet: TaggedRecord[] = [{ name: "golf", quantity: 3, tags: [1] }];
      const data = createTaggedCrossfilter();
      data.add(firstSet);
      data.quantity.filterExact(3);
      data.remove();
      data.quantity.filterAll();
      data.tags.filterFunction((d) => d === 1);
      data.remove();
      data.tags.filterAll();
      data.add(secondSet);
      expect(data.tags.top(3)).toStrictEqual([
        { name: "echo", quantity: 2, tags: [4] },
        { name: "golf", quantity: 3, tags: [1] },
        { name: "foxtrot", quantity: 1, tags: [] },
      ]);
    });

    it("filter then remove empty tag to only one tag", () => {
      const set: TaggedRecord[] = [
        { name: "alpha", quantity: 2, tags: [1] },
        { name: "bravo", quantity: 1, tags: [] },
      ];
      const data = createTaggedCrossfilter();
      data.add(set);
      data.quantity.filterExact(1);
      data.remove();
      data.quantity.filterAll();
      expect(data.tags.top(2)).toStrictEqual([{ name: "alpha", quantity: 2, tags: [1] }]);
    });

    it("filter remove one tag to only empty tag", () => {
      const set: TaggedRecord[] = [
        { name: "alpha", quantity: 2, tags: [1] },
        { name: "bravo", quantity: 1, tags: [] },
      ];
      const data = createTaggedCrossfilter();
      data.add(set);
      data.quantity.filterExact(2);
      data.remove();
      data.quantity.filterAll();
      expect(data.tags.top(2)).toStrictEqual([{ name: "bravo", quantity: 1, tags: [] }]);
    });

    it("remove multiple tag, add single tag, others observer filter", () => {
      const firstSet: TaggedRecord[] = [
        { name: "alpha", quantity: 2, tags: [1] },
        { name: "bravo", quantity: 1, tags: [2, 3] },
      ];
      const secondSet: TaggedRecord[] = [{ name: "charlie", quantity: 3, tags: [4] }];
      const data = createTaggedCrossfilter();
      data.add(firstSet);
      data.quantity.filterExact(1);
      data.remove();
      data.quantity.filterAll();
      data.add(secondSet);
      data.tags.filterExact(1);
      expect(data.quantity.top(2)).toStrictEqual([{ name: "alpha", quantity: 2, tags: [1] }]);
    });
  });

  describe("group", () => {
    it("other dimension filtered remove", () => {
      const set: TaggedRecord[] = [
        { name: "alpha", quantity: 1, tags: [1, 3] },
        { name: "bravo", quantity: 0, tags: [1, 3] },
        { name: "charlie", quantity: 3, tags: [2] },
        { name: "delta", quantity: 3, tags: [2, 3] },
        { name: "echo", quantity: 2, tags: [4] },
        { name: "foxtrot", quantity: 1, tags: [] },
      ];
      const data = createTaggedCrossfilterWithGroup();
      data.add(set);
      data.quantity.filterExact(3);
      data.tagGroup.top(5);
      data.remove();
      data.quantity.filterAll();
      expect(data.tagGroup.all()).toStrictEqual([
        { key: 1, value: 2 },
        { key: 3, value: 2 },
        { key: 4, value: 1 },
      ]);
    });

    it("self filterExact remove", () => {
      const set: TaggedRecord[] = [
        { name: "alpha", quantity: 1, tags: [1, 3] },
        { name: "bravo", quantity: 0, tags: [1, 3] },
        { name: "charlie", quantity: 3, tags: [2] },
        { name: "delta", quantity: 3, tags: [2, 3] },
        { name: "echo", quantity: 2, tags: [4] },
        { name: "foxtrot", quantity: 1, tags: [] },
      ];
      const data = createTaggedCrossfilterWithGroup();
      data.add(set);
      data.tags.filterExact(2);
      data.remove();
      data.tags.filterAll();
      expect(data.tagGroup.all()).toStrictEqual([
        { key: 1, value: 2 },
        { key: 3, value: 2 },
        { key: 4, value: 1 },
      ]);
    });

    it("self filterFunction remove", () => {
      const set: TaggedRecord[] = [
        { name: "alpha", quantity: 1, tags: [1, 3] },
        { name: "bravo", quantity: 0, tags: [1, 3] },
        { name: "charlie", quantity: 3, tags: [2] },
        { name: "delta", quantity: 3, tags: [2, 3] },
        { name: "echo", quantity: 2, tags: [4] },
        { name: "foxtrot", quantity: 1, tags: [] },
      ];
      const data = createTaggedCrossfilterWithGroup();
      data.add(set);
      data.tags.filterFunction((d) => d === 2);
      data.remove();
      data.tags.filterAll();
      expect(data.tagGroup.all()).toStrictEqual([
        { key: 1, value: 2 },
        { key: 3, value: 2 },
        { key: 4, value: 1 },
      ]);
    });

    it("other dimension filtered then self filterFunction remove", () => {
      const set: TaggedRecord[] = [
        { name: "alpha", quantity: 1, tags: [1, 3] },
        { name: "bravo", quantity: 0, tags: [1, 3] },
        { name: "charlie", quantity: 3, tags: [2] },
        { name: "delta", quantity: 3, tags: [2, 3] },
        { name: "echo", quantity: 2, tags: [4] },
        { name: "foxtrot", quantity: 1, tags: [] },
      ];
      const data = createTaggedCrossfilterWithGroup();
      data.add(set);
      data.quantity.filterExact(3);
      data.remove();
      data.quantity.filterAll();
      data.tags.filterFunction((d) => d === 1);
      data.remove();
      data.tags.filterAll();
      expect(data.tagGroup.all()).toStrictEqual([{ key: 4, value: 1 }]);
    });

    it("filter then remove to one tag with one empty", () => {
      const set: TaggedRecord[] = [
        { name: "alpha", quantity: 2, tags: [1] },
        { name: "bravo", quantity: 1, tags: [] },
        { name: "charlie", quantity: 0, tags: [2] },
      ];
      const data = createTaggedCrossfilterWithGroup();
      data.add(set);
      data.quantity.filterExact(0);
      data.remove();
      data.quantity.filterAll();
      expect(data.tagGroup.all()).toStrictEqual([{ key: 1, value: 1 }]);
    });

    it("filter then remove empty tag to only one tag", () => {
      const set: TaggedRecord[] = [
        { name: "alpha", quantity: 2, tags: [1] },
        { name: "bravo", quantity: 1, tags: [] },
      ];
      const data = createTaggedCrossfilterWithGroup();
      data.add(set);
      data.quantity.filterExact(1);
      data.remove();
      data.quantity.filterAll();
      expect(data.tagGroup.all()).toStrictEqual([{ key: 1, value: 1 }]);
    });

    it("filter then remove one tag to only empty tag", () => {
      const set: TaggedRecord[] = [
        { name: "alpha", quantity: 2, tags: [1] },
        { name: "bravo", quantity: 1, tags: [] },
      ];
      const data = createTaggedCrossfilterWithGroup();
      data.add(set);
      data.quantity.filterExact(2);
      data.remove();
      data.quantity.filterAll();
      expect(data.tagGroup.all()).toStrictEqual([]);
    });

    it("remove then add one tag back", () => {
      const firstSet: TaggedRecord[] = [
        { name: "alpha", quantity: 2, tags: [1] },
        { name: "bravo", quantity: 1, tags: [] },
      ];
      const secondSet: TaggedRecord[] = [{ name: "alpha", quantity: 2, tags: [1] }];
      const data = createTaggedCrossfilterWithGroup();
      data.add(firstSet);
      data.quantity.filterExact(2);
      data.remove();
      data.quantity.filterAll();
      data.add(secondSet);
      expect(data.tagGroup.all()).toStrictEqual([{ key: 1, value: 1 }]);
    });

    it("remove then add empty tag back", () => {
      const firstSet: TaggedRecord[] = [
        { name: "alpha", quantity: 2, tags: [1] },
        { name: "bravo", quantity: 1, tags: [] },
      ];
      const secondSet: TaggedRecord[] = [{ name: "bravo", quantity: 1, tags: [] }];
      const data = createTaggedCrossfilterWithGroup();
      data.add(firstSet);
      data.quantity.filterExact(1);
      data.remove();
      data.quantity.filterAll();
      data.add(secondSet);
      expect(data.tagGroup.all()).toStrictEqual([{ key: 1, value: 1 }]);
    });
  });
});
