import { describe, it, expect, beforeEach } from "vitest";
import crossfilter from "../index.ts";
import type { Crossfilter, Dimension, EventName } from "../index.ts";
import { createFixture, testData } from "./fixtures.ts";
import type { Fixture, Sale } from "./fixtures.ts";

const range = (start: number, stop: number): number[] =>
  Array.from({ length: stop - start }, (_, i) => start + i);

describe("crossfilter", () => {
  let data: Fixture;

  beforeEach(() => {
    data = createFixture();
  });

  it("up to 32 dimensions supported", () => {
    const data = crossfilter<never>([]);
    for (let i = 0; i < 32; i++) data.dimension(() => 0);
  });

  it("can add and remove 32 dimensions repeatedly", () => {
    const data = crossfilter<never>([]);
    const dimensions: Dimension<never, number>[] = [];
    for (let j = 0; j < 10; j++) {
      for (let i = 0; i < 32; i++) dimensions.push(data.dimension(() => 0));
      while (dimensions.length) dimensions.pop()?.dispose();
    }
  });

  describe("empty data", () => {
    type QuantityRecord = { quantity: number; total: number };

    const createEmptyFixture = () => {
      const cf = crossfilter<QuantityRecord>();
      return Object.assign(cf, { quantity: cf.dimension((d) => d.quantity) });
    };
    type EmptyFixture = ReturnType<typeof createEmptyFixture>;

    let data: EmptyFixture;

    beforeEach(() => {
      data = createEmptyFixture();
    });

    describe("groupAll", () => {
      const createAllGrouped = (fixture: EmptyFixture) => fixture.groupAll();
      let allGrouped: ReturnType<typeof createAllGrouped>;

      beforeEach(() => {
        allGrouped = createAllGrouped(data);
      });

      it("value", () => {
        expect(allGrouped.value()).toBe(0);
      });
      it("value after removing all data", () => {
        try {
          data.add([{ quantity: 2, total: 190 }]);
          expect(allGrouped.value()).toBe(1);
        } finally {
          data.remove();
          expect(allGrouped.value()).toBe(0);
        }
      });
    });

    describe("dimension", () => {
      describe("groupAll (count, the default)", () => {
        const createCount = (fixture: EmptyFixture) => fixture.quantity.groupAll();
        let count: ReturnType<typeof createCount>;

        beforeEach(() => {
          count = createCount(data);
        });

        it("value", () => {
          expect(count.value()).toBe(0);
        });

        it("value after removing all data", () => {
          try {
            data.add([{ quantity: 2, total: 190 }]);
            expect(count.value()).toBe(1);
          } finally {
            data.remove();
            expect(count.value()).toBe(0);
          }
        });
      });

      describe("groupAll (sum of total)", () => {
        const createTotal = (fixture: EmptyFixture) =>
          fixture.quantity.groupAll().reduceSum((d) => d.total);
        let total: ReturnType<typeof createTotal>;

        beforeEach(() => {
          total = createTotal(data);
        });

        it("value", () => {
          expect(total.value()).toBe(0);
        });

        it("value after removing all data", () => {
          try {
            data.add([{ quantity: 2, total: 190 }]);
            expect(total.value()).toBe(190);
          } finally {
            data.remove();
            expect(total.value()).toBe(0);
          }
        });
      });

      describe("groupAll (custom reduce)", () => {
        const add = (p: number, _v: QuantityRecord) => p + 1;
        const remove = (p: number, _v: QuantityRecord) => p - 1;
        const initial = () => 1;
        const createCustom = (fixture: EmptyFixture) =>
          fixture.quantity.groupAll().reduce(add, remove, initial);
        let custom: ReturnType<typeof createCustom>;

        beforeEach(() => {
          custom = createCustom(data);
        });

        it("value", () => {
          expect(custom.value()).toBe(1);
        });
        it("value after removing all data", () => {
          try {
            data.add([{ quantity: 2, total: 190 }]);
            expect(custom.value()).toBe(2);
          } finally {
            data.remove();
            expect(custom.value()).toBe(1);
          }
        });
      });

      describe("groupAll (custom reduce information lifecycle)", () => {
        type FooValRecord = { foo: number; val: number };

        const createLifecycleFixture = () => {
          const cf = crossfilter<FooValRecord>();
          cf.add([
            { foo: 1, val: 2 },
            { foo: 2, val: 2 },
            { foo: 3, val: 2 },
            { foo: 3, val: 2 },
          ]);
          const foo = cf.dimension((d) => d.foo);
          const bar = cf.dimension((d) => d.foo);
          const val = cf.dimension((d) => d.val);
          const groupMax = bar.groupAll().reduce(
            (p: number, v: FooValRecord, n) => {
              if (n) p += v.val;
              return p;
            },
            (p: number, v: FooValRecord, n) => {
              if (n) p -= v.val;
              return p;
            },
            () => 0,
          );
          const groupSum = bar.groupAll().reduceSum((d) => d.val);
          return Object.assign(cf, { foo, bar, val, groupMax, groupSum });
        };

        let data: ReturnType<typeof createLifecycleFixture>;

        beforeEach(() => {
          data = createLifecycleFixture();
        });

        it("on group creation", () => {
          expect(data.groupMax.value()).toStrictEqual(data.groupSum.value());
        });

        it("on filtering", () => {
          data.foo.filterRange([1, 3]);
          expect(data.groupMax.value()).toStrictEqual(8);
          expect(data.groupSum.value()).toStrictEqual(4);
          data.foo.filterAll();
        });

        it("on adding data after group creation", () => {
          data.add([{ foo: 1, val: 2 }]);
          expect(data.groupMax.value()).toStrictEqual(data.groupSum.value());
        });

        it("on adding data when a filter is in place", () => {
          data.add([{ foo: 1, val: 2 }]);
          data.foo.filterRange([1, 3]);
          data.add([{ foo: 3, val: 1 }]);
          expect(data.groupMax.value()).toStrictEqual(11);
          expect(data.groupSum.value()).toStrictEqual(6);
          data.foo.filterAll();
        });

        it("on removing data after group creation", () => {
          data.add([{ foo: 1, val: 2 }]);
          data.foo.filterRange([1, 3]);
          data.add([{ foo: 3, val: 1 }]);
          data.foo.filterAll();
          data.val.filter(1);
          data.remove();
          expect(data.groupMax.value()).toStrictEqual(10);
          expect(data.groupSum.value()).toStrictEqual(0);

          data.val.filterAll();
          expect(data.groupMax.value()).toStrictEqual(data.groupSum.value());
        });
      });
    });
  });

  it("up to 64 dimensions supported", () => {
    const data = crossfilter<never>([]);
    for (let i = 0; i < 64; i++) data.dimension(() => 0);
  });

  it("can add and remove 64 dimensions repeatedly", () => {
    const data = crossfilter<never>([]);
    const dimensions: Dimension<never, number>[] = [];
    for (let j = 0; j < 10; j++) {
      for (let i = 0; i < 64; i++) dimensions.push(data.dimension(() => 0));
      while (dimensions.length) dimensions.pop()?.remove();
    }
  });

  it("filtering with more than 32 dimensions", () => {
    const data = crossfilter<{ value: number }>();
    const dims: Dimension<{ value: number }, boolean>[] = [];

    for (let i = 0; i < 50; i++) {
      data.add([{ value: i }]);
    }

    const dimfunc = (i: number) => (val: { value: number }) => val.value === i;

    for (let i = 0; i < 50; i++) {
      dims[i] = data.dimension(dimfunc(i));
    }

    for (let i = 0; i < 50; i++) {
      dims[i].filterExact(true);
      data.remove();
      dims[i].filterAll();
      expect(data.size()).toBe(49 - i);
    }
  });

  describe("groupAll", () => {
    const createAllGrouped = (fixture: Fixture) => fixture.groupAll().reduceSum((d) => d.total);
    let allGrouped: ReturnType<typeof createAllGrouped>;

    beforeEach(() => {
      allGrouped = createAllGrouped(data);
    });

    it("does not have top and order methods", () => {
      expect("top" in allGrouped).toBe(false);
      expect("order" in allGrouped).toBe(false);
    });

    describe("reduce", () => {
      it("determines the computed reduce value", () => {
        try {
          allGrouped.reduceCount();
          expect(allGrouped.value()).toBe(43);
        } finally {
          allGrouped.reduceSum((d) => d.total);
        }
      });

      describe("gives reduce functions information on lifecycle of data element", () => {
        type FooValRecord = { foo: number; val: number };

        const createLifecycleFixture = () => {
          const cf = crossfilter<FooValRecord>();
          cf.add([
            { foo: 1, val: 2 },
            { foo: 2, val: 2 },
            { foo: 3, val: 2 },
            { foo: 3, val: 2 },
          ]);
          const foo = cf.dimension((d) => d.foo);
          const bar = cf.dimension((d) => d.foo);
          const val = cf.dimension((d) => d.val);
          const groupMax = cf.groupAll().reduce(
            (p: number, v: FooValRecord, n) => {
              if (n) p += v.val;
              return p;
            },
            (p: number, v: FooValRecord, n) => {
              if (n) p -= v.val;
              return p;
            },
            () => 0,
          );
          const groupSum = cf.groupAll().reduceSum((d) => d.val);
          return Object.assign(cf, { foo, bar, val, groupMax, groupSum });
        };

        let data: ReturnType<typeof createLifecycleFixture>;

        beforeEach(() => {
          data = createLifecycleFixture();
        });

        it("on group creation", () => {
          expect(data.groupMax.value()).toStrictEqual(data.groupSum.value());
        });

        it("on filtering", () => {
          data.foo.filterRange([1, 3]);
          expect(data.groupMax.value()).toStrictEqual(8);
          expect(data.groupSum.value()).toStrictEqual(4);
          data.foo.filterAll();
        });

        it("on adding data after group creation", () => {
          data.add([{ foo: 1, val: 2 }]);
          expect(data.groupMax.value()).toStrictEqual(data.groupSum.value());
        });

        it("on adding data when a filter is in place", () => {
          data.add([{ foo: 1, val: 2 }]);
          data.foo.filterRange([1, 3]);
          data.add([{ foo: 3, val: 1 }]);
          expect(data.groupMax.value()).toStrictEqual(11);
          expect(data.groupSum.value()).toStrictEqual(6);
          data.foo.filterAll();
        });

        it("on removing data after group creation", () => {
          data.add([{ foo: 1, val: 2 }]);
          data.foo.filterRange([1, 3]);
          data.add([{ foo: 3, val: 1 }]);
          data.foo.filterAll();
          data.val.filter(1);
          data.remove();
          expect(data.groupMax.value()).toStrictEqual(10);
          expect(data.groupSum.value()).toStrictEqual(0);

          data.val.filterAll();
          expect(data.groupMax.value()).toStrictEqual(data.groupSum.value());
        });
      });
    });

    describe("value", () => {
      it("returns the sum total of matching records", () => {
        expect(allGrouped.value()).toBe(6660);
      });

      it("observes all dimension's filters", () => {
        try {
          data.type.filterExact("tab");
          expect(allGrouped.value()).toBe(4760);
          data.type.filterExact("visa");
          expect(allGrouped.value()).toBe(1400);
          data.tip.filterExact(100);
          expect(allGrouped.value()).toBe(1000);
        } finally {
          data.type.filterAll();
          data.tip.filterAll();
        }
      });
    });

    describe("dispose", () => {
      it("detaches from reduce listeners", () => {
        const data = crossfilter<number>([0, 1, 2]);
        let callback = false;
        const other = data.dimension((d) => d);
        const all = data.groupAll().reduce(
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
        const data = crossfilter<number>([0, 1, 2]);
        let callback = false;
        const all = data.groupAll().reduce(
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

      it("does not detach other reduce listeners", () => {
        const data = crossfilter<number>([0, 1, 2]);
        let callback = false;
        const other = data.dimension((d) => d);
        const all = data.groupAll();
        const all2 = data.groupAll().reduce(
          () => {
            callback = true;
          },
          () => {
            callback = true;
          },
          () => {},
        );
        all2.value();
        callback = false;
        all.dispose();
        other.filterRange([1, 2]);
        expect(callback).toBe(true);
      });

      it("does not detach other add listeners", () => {
        const data = crossfilter<number>([0, 1, 2]);
        let callback = false;
        const all = data.groupAll();
        const all2 = data.groupAll().reduce(
          () => {
            callback = true;
          },
          () => {
            callback = true;
          },
          () => {},
        );
        all2.value();
        callback = false;
        all.dispose();
        data.add([3, 4, 5]);
        expect(callback).toBe(true);
      });
    });
  });

  describe("size", () => {
    it("returns the total number of elements", () => {
      expect(data.size()).toBe(43);
    });

    it("is not affected by any dimension filters", () => {
      try {
        data.quantity.filterExact(4);
        expect(data.size()).toBe(43);
      } finally {
        data.quantity.filterAll();
      }
    });
  });

  describe("all", () => {
    it("returns the full data array", () => {
      const raw = data.all();
      expect(raw.length).toBe(43);
    });

    it("is not affected by any dimension filters", () => {
      try {
        data.quantity.filterExact(4);
        const raw = data.all();
        expect(raw.length).toBe(43);
      } finally {
        data.quantity.filterAll();
      }
    });
  });

  describe("allFiltered", () => {
    it("returns the full data array if no filters applied", () => {
      const raw = data.allFiltered();
      expect(raw.length).toBe(43);
    });

    it("is affected by all dimension filters", () => {
      try {
        data.quantity.filterExact(4);
        let raw = data.allFiltered();
        expect(raw.length).toBe(1);

        data.quantity.filterExact(2);
        raw = data.allFiltered();
        expect(raw.length).toBe(35);

        data.total.filterRange([190, 300]);
        raw = data.allFiltered();
        expect(raw.length).toBe(18);
      } finally {
        data.quantity.filterAll();
        data.total.filterAll();
      }
    });

    it("is affected by all dimensions filters, except those in ignore_dimensions", () => {
      try {
        data.quantity.filterExact(2);
        let raw = data.allFiltered([data.quantity]);
        expect(raw.length).toBe(43);

        data.total.filterRange([190, 300]);
        raw = data.allFiltered([data.total]);
        expect(raw.length).toBe(35);

        raw = data.allFiltered([data.quantity, data.total]);
        expect(raw.length).toBe(43);
      } finally {
        data.quantity.filterAll();
        data.total.filterAll();
      }
    });
  });

  describe("add", () => {
    it("increases the size of the crossfilter", () => {
      const data = crossfilter<number>([]);
      expect(data.size()).toBe(0);
      data.add([0, 1, 2, 3, 4, 5, 6, 6, 6, 7]);
      expect(data.size()).toBe(10);
      data.add([]);
      expect(data.size()).toBe(10);
    });

    it("existing filters are consistent with new records", () => {
      const data = crossfilter<number>([]);
      const foo = data.dimension((d) => +d);
      const bar = data.dimension((d) => -d);
      expect(foo.top(Infinity)).toStrictEqual([]);
      foo.filterExact(42);
      data.add([43, 42, 41]);
      expect(foo.top(Infinity)).toStrictEqual([42]);
      expect(bar.top(Infinity)).toStrictEqual([42]);
      data.add([43, 42]);
      expect(foo.top(Infinity)).toStrictEqual([42, 42]);
      expect(bar.top(Infinity)).toStrictEqual([42, 42]);
      foo.filterRange([42, 44]);
      data.add([43]);
      expect(foo.top(Infinity)).toStrictEqual([43, 43, 43, 42, 42]);
      expect(bar.top(Infinity)).toStrictEqual([42, 42, 43, 43, 43]);
      foo.filterFunction((d) => d % 2 === 1);
      data.add([44, 44, 45]);
      expect(foo.top(Infinity)).toStrictEqual([45, 43, 43, 43, 41]);
      expect(bar.top(Infinity)).toStrictEqual([41, 43, 43, 43, 45]);
      bar.filterExact(-43);
      expect(bar.top(Infinity)).toStrictEqual([43, 43, 43]);
      data.add([43]);
      expect(bar.top(Infinity)).toStrictEqual([43, 43, 43, 43]);
      bar.filterAll();
      data.add([0]);
      expect(bar.top(Infinity)).toStrictEqual([41, 43, 43, 43, 43, 45]);
      foo.filterAll();
      expect(bar.top(Infinity)).toStrictEqual([0, 41, 42, 42, 43, 43, 43, 43, 44, 44, 45]);
    });

    it("existing groups are consistent with new records", () => {
      const data = crossfilter<number>([]);
      const foo = data.dimension((d) => +d);
      const bar = data.dimension((d) => -d);
      const foos = foo.group();
      const all = data.groupAll();
      expect(all.value()).toBe(0);
      expect(foos.all()).toStrictEqual([]);
      foo.filterExact(42);
      data.add([43, 42, 41]);
      expect(all.value()).toBe(1);
      expect(foos.all()).toStrictEqual([
        { key: 41, value: 1 },
        { key: 42, value: 1 },
        { key: 43, value: 1 },
      ]);
      bar.filterExact(-42);
      expect(all.value()).toBe(1);
      expect(foos.all()).toStrictEqual([
        { key: 41, value: 0 },
        { key: 42, value: 1 },
        { key: 43, value: 0 },
      ]);
      data.add([43, 42, 41]);
      expect(all.value()).toBe(2);
      expect(foos.all()).toStrictEqual([
        { key: 41, value: 0 },
        { key: 42, value: 2 },
        { key: 43, value: 0 },
      ]);
      bar.filterAll();
      expect(all.value()).toBe(2);
      expect(foos.all()).toStrictEqual([
        { key: 41, value: 2 },
        { key: 42, value: 2 },
        { key: 43, value: 2 },
      ]);
      foo.filterAll();
      expect(all.value()).toBe(6);
    });

    describe("tag dimension with zero keys", () => {
      it("three empties", () => {
        const rows: { id: number; links: string[] }[] = [
          { id: 1, links: [] },
          { id: 2, links: [] },
          { id: 3, links: [] },
        ];
        const ndx = crossfilter(rows);
        const dimLinks = ndx.dimension((r) => r.links, true);
        dimLinks.filter("vv");
        expect(dimLinks.top(Infinity).length).toBe(0);
      });
    });

    describe("tag dimension with one key", () => {
      it("one key once", () => {
        const rows: { id: number; links: string[] }[] = [
          { id: 1, links: ["vv"] },
          { id: 2, links: [] },
        ];
        const ndx = crossfilter(rows);
        const dimLinks = ndx.dimension((r) => r.links, true);
        dimLinks.filter("vv");
        expect(dimLinks.top(Infinity).length).toBe(1);
      });

      it("one key doubled", () => {
        const rows: { id: number; links: string[] }[] = [
          { id: 1, links: ["vv", "vv"] },
          { id: 2, links: [] },
        ];
        const ndx = crossfilter(rows);
        const dimLinks = ndx.dimension((r) => r.links, true);
        dimLinks.filter("vv");
        expect(dimLinks.top(Infinity).length).toBe(2);
        expect(ndx.allFiltered().length).toBe(1);
      });

      it("one key twice", () => {
        const rows: { id: number; links: string[] }[] = [
          { id: 1, links: [] },
          { id: 2, links: ["vv"] },
          { id: 3, links: ["vv"] },
        ];
        const ndx = crossfilter(rows);
        const dimLinks = ndx.dimension((r) => r.links, true);
        dimLinks.filter("vv");
        expect(dimLinks.top(Infinity).length).toBe(2);
      });
    });

    it("can add new groups that are before existing groups", () => {
      const order = (p: { foo: number }) => p.foo;
      const add = (p: { foo: number }) => {
        ++p.foo;
        return p;
      };
      const remove = (p: { foo: number }) => {
        --p.foo;
        return p;
      };
      const initial = () => ({ foo: 0 });
      const data = crossfilter<number>();
      const foo = data.dimension((d) => +d);
      const foos = foo.group().reduce(add, remove, initial).order(order);
      data.add([2]).add([1, 1, 1]);
      expect(foos.top(2)).toStrictEqual([
        { key: 1, value: { foo: 3 } },
        { key: 2, value: { foo: 1 } },
      ]);
    });

    it("can add more than 256 groups", () => {
      const data = crossfilter<number>();
      const foo = data.dimension((d) => +d);
      const bar = data.dimension((d) => +d);
      const foos = foo.group();
      data.add(range(0, 256));
      expect(foos.all().map((d) => d.key)).toStrictEqual(range(0, 256));
      expect(foos.all().every((d) => d.value === 1)).toBe(true);
      data.add([128]);
      expect(foos.top(1)).toStrictEqual([{ key: 128, value: 2 }]);
      bar.filterExact(0);
      data.add(range(-256, 0));
      expect(foos.all().map((d) => d.key)).toStrictEqual(range(-256, 256));
      expect(foos.top(1)).toStrictEqual([{ key: 0, value: 1 }]);
    });

    it("can add lots of groups in reverse order", () => {
      const data = crossfilter<{ foo: number; bar: number; baz: number }>();
      const foo = data.dimension((d) => -d.foo);
      const bar = data.dimension((d) => d.bar);
      const foos = foo.group(Math.floor).reduceSum((d) => d.foo);
      bar.filterExact(1);
      for (let i = 0; i < 1000; i++) {
        data.add(range(0, 10).map((d) => ({ foo: i + d / 10, bar: i % 4, baz: d + i * 10 })));
      }
      expect(foos.top(1)).toStrictEqual([{ key: -998, value: 8977.5 }]);
    });

    it("can add a record that matches the tag filter", () => {
      const data2 = crossfilter<{ foo: number[]; bar: number }>();
      const fooDimension = data2.dimension((d) => d.foo, true);
      data2.add([
        { foo: [1, 2, 3], bar: 1 },
        { foo: [1, 2], bar: 2 },
        { foo: [2, 3], bar: 4 },
      ]);
      const another = { foo: [1, 3], bar: 8 };

      const fooGroup = fooDimension.group();
      const allBarSum = data2.groupAll().reduceSum((d) => d.bar);
      const fooBarSum = fooDimension.group().reduceSum((d) => d.bar);
      const barDim = data2.dimension((d) => d.bar);
      const barGroup = barDim.group();

      expect(allBarSum.value()).toBe(7);
      expect(fooGroup.all()).toStrictEqual([
        { key: 1, value: 2 },
        { key: 2, value: 3 },
        { key: 3, value: 2 },
      ]);
      expect(fooBarSum.all()).toStrictEqual([
        { key: 1, value: 3 },
        { key: 2, value: 7 },
        { key: 3, value: 5 },
      ]);

      fooDimension.filter(3);
      expect(allBarSum.value()).toBe(5);

      data2.add([another]);

      expect(data2.size()).toBe(4);
      expect(allBarSum.value()).toBe(13);
      expect(data2.allFiltered().length).toBe(3);

      expect(fooGroup.all()).toStrictEqual([
        { key: 1, value: 3 },
        { key: 2, value: 3 },
        { key: 3, value: 3 },
      ]);
      expect(fooBarSum.all()).toStrictEqual([
        { key: 1, value: 11 },
        { key: 2, value: 7 },
        { key: 3, value: 13 },
      ]);

      expect(barGroup.all()).toStrictEqual([
        { key: 1, value: 1 },
        { key: 2, value: 0 },
        { key: 4, value: 1 },
        { key: 8, value: 1 },
      ]);

      fooDimension.filterAll();

      expect(allBarSum.value()).toBe(15);
      expect(data2.allFiltered().length).toBe(4);

      data2.remove(() => true);
      expect(fooDimension.top(Infinity)).toStrictEqual([]);
    });

    it("can add a record that matches the tag filter function", () => {
      const data2 = crossfilter<{ foo: number[]; bar: number }>();
      const fooDimension = data2.dimension((d) => d.foo, true);
      data2.add([
        { foo: [1, 2, 3], bar: 1 },
        { foo: [1, 2], bar: 2 },
        { foo: [2, 3], bar: 4 },
      ]);
      const another = { foo: [1, 3], bar: 8 };

      const fooGroup = fooDimension.group();
      const allBarSum = data2.groupAll().reduceSum((d) => d.bar);
      const fooBarSum = fooDimension.group().reduceSum((d) => d.bar);
      const barDim = data2.dimension((d) => d.bar);
      const barGroup = barDim.group();

      expect(allBarSum.value()).toBe(7);
      expect(fooGroup.all()).toStrictEqual([
        { key: 1, value: 2 },
        { key: 2, value: 3 },
        { key: 3, value: 2 },
      ]);
      expect(fooBarSum.all()).toStrictEqual([
        { key: 1, value: 3 },
        { key: 2, value: 7 },
        { key: 3, value: 5 },
      ]);

      fooDimension.filterFunction((k) => k === 3);
      expect(allBarSum.value()).toBe(5);

      data2.add([another]);

      expect(data2.size()).toBe(4);
      expect(allBarSum.value()).toBe(13);
      expect(data2.allFiltered().length).toBe(3);

      expect(fooGroup.all()).toStrictEqual([
        { key: 1, value: 3 },
        { key: 2, value: 3 },
        { key: 3, value: 3 },
      ]);
      expect(fooBarSum.all()).toStrictEqual([
        { key: 1, value: 11 },
        { key: 2, value: 7 },
        { key: 3, value: 13 },
      ]);

      expect(barGroup.all()).toStrictEqual([
        { key: 1, value: 1 },
        { key: 2, value: 0 },
        { key: 4, value: 1 },
        { key: 8, value: 1 },
      ]);

      fooDimension.filterAll();

      expect(allBarSum.value()).toBe(15);
      expect(data2.allFiltered().length).toBe(4);

      data2.remove(() => true);
      expect(fooDimension.top(Infinity)).toStrictEqual([]);
    });

    it("can add a record that doesn't match the tag filter", () => {
      const data2 = crossfilter<{ foo: number[]; bar: number }>();
      const fooDimension = data2.dimension((d) => d.foo, true);
      data2.add([
        { foo: [1, 2, 3], bar: 1 },
        { foo: [1, 2], bar: 2 },
        { foo: [2, 3], bar: 4 },
      ]);
      const yetanother = { foo: [2], bar: 8 };

      const fooGroup = fooDimension.group();
      const allBarSum = data2.groupAll().reduceSum((d) => d.bar);
      const fooBarSum = fooDimension.group().reduceSum((d) => d.bar);
      const barDim = data2.dimension((d) => d.bar);
      const barGroup = barDim.group();

      expect(allBarSum.value()).toBe(7);
      expect(fooGroup.all()).toStrictEqual([
        { key: 1, value: 2 },
        { key: 2, value: 3 },
        { key: 3, value: 2 },
      ]);
      expect(fooBarSum.all()).toStrictEqual([
        { key: 1, value: 3 },
        { key: 2, value: 7 },
        { key: 3, value: 5 },
      ]);

      fooDimension.filter(3);
      expect(allBarSum.value()).toBe(5);

      data2.add([yetanother]);

      expect(data2.size()).toBe(4);
      expect(allBarSum.value()).toBe(5);
      expect(data2.allFiltered().length).toBe(2);

      expect(fooGroup.all()).toStrictEqual([
        { key: 1, value: 2 },
        { key: 2, value: 4 },
        { key: 3, value: 2 },
      ]);
      expect(fooBarSum.all()).toStrictEqual([
        { key: 1, value: 3 },
        { key: 2, value: 15 },
        { key: 3, value: 5 },
      ]);

      expect(barGroup.all()).toStrictEqual([
        { key: 1, value: 1 },
        { key: 2, value: 0 },
        { key: 4, value: 1 },
        { key: 8, value: 0 },
      ]);

      fooDimension.filterAll();

      expect(allBarSum.value()).toBe(15);
      expect(data2.allFiltered().length).toBe(4);

      data2.remove(() => true);
      expect(fooDimension.top(Infinity)).toStrictEqual([]);
    });

    it("can add a record that doesn't match the tag filter function", () => {
      const data2 = crossfilter<{ foo: number[]; bar: number }>();
      const fooDimension = data2.dimension((d) => d.foo, true);
      data2.add([
        { foo: [1, 2, 3], bar: 1 },
        { foo: [1, 2], bar: 2 },
        { foo: [2, 3], bar: 4 },
      ]);
      const yetanother = { foo: [2], bar: 8 };

      const fooGroup = fooDimension.group();
      const allBarSum = data2.groupAll().reduceSum((d) => d.bar);
      const fooBarSum = fooDimension.group().reduceSum((d) => d.bar);
      const barDim = data2.dimension((d) => d.bar);
      const barGroup = barDim.group();

      expect(allBarSum.value()).toBe(7);
      expect(fooGroup.all()).toStrictEqual([
        { key: 1, value: 2 },
        { key: 2, value: 3 },
        { key: 3, value: 2 },
      ]);
      expect(fooBarSum.all()).toStrictEqual([
        { key: 1, value: 3 },
        { key: 2, value: 7 },
        { key: 3, value: 5 },
      ]);

      fooDimension.filterFunction((k) => k === 3);
      expect(allBarSum.value()).toBe(5);

      data2.add([yetanother]);

      expect(data2.size()).toBe(4);
      expect(allBarSum.value()).toBe(5);
      expect(data2.allFiltered().length).toBe(2);

      expect(fooGroup.all()).toStrictEqual([
        { key: 1, value: 2 },
        { key: 2, value: 4 },
        { key: 3, value: 2 },
      ]);
      expect(fooBarSum.all()).toStrictEqual([
        { key: 1, value: 3 },
        { key: 2, value: 15 },
        { key: 3, value: 5 },
      ]);

      expect(barGroup.all()).toStrictEqual([
        { key: 1, value: 1 },
        { key: 2, value: 0 },
        { key: 4, value: 1 },
        { key: 8, value: 0 },
      ]);

      fooDimension.filterAll();

      expect(allBarSum.value()).toBe(15);
      expect(data2.allFiltered().length).toBe(4);

      data2.remove(() => true);
      expect(fooDimension.top(Infinity)).toStrictEqual([]);
    });
  });

  describe("remove", () => {
    const createFooFixture = () => {
      const cf = crossfilter<{ foo: number }>();
      const foo = cf.dimension((d) => d.foo);
      return Object.assign(cf, {
        foo: Object.assign(foo, {
          div2: foo.group((value) => Math.floor(value / 2)),
          positive: foo.group((value) => (value > 0 ? 1 : 0)),
        }),
      });
    };
    let data: ReturnType<typeof createFooFixture>;

    beforeEach(() => {
      data = createFooFixture();
    });

    it("removing a record works for a group with cardinality one", () => {
      data.add([{ foo: 1 }, { foo: 1.1 }, { foo: 1.2 }]);
      data.foo.filter(1.1);
      data.remove();
      data.foo.filterAll();
      data.remove();
      expect(data.foo.top(Infinity)).toStrictEqual([]);
    });

    it("removing a record works for another group with cardinality one", () => {
      data.add([{ foo: 0 }, { foo: -1 }]);
      expect(data.foo.positive.all()).toStrictEqual([{ key: 0, value: 2 }]);
      data.foo.filter(0);
      data.remove();
      expect(data.foo.positive.all()).toStrictEqual([{ key: 0, value: 1 }]);
      data.foo.filterAll();
      expect(data.foo.top(Infinity)).toStrictEqual([{ foo: -1 }]);
      data.remove();
      expect(data.foo.top(Infinity)).toStrictEqual([]);
    });

    it("removing a record updates dimension", () => {
      data.add([{ foo: 1 }, { foo: 2 }]);
      data.foo.filterExact(1);
      data.remove();
      data.foo.filterAll();
      expect(data.foo.top(Infinity)).toStrictEqual([{ foo: 2 }]);
      data.remove();
      expect(data.foo.top(Infinity)).toStrictEqual([]);
    });

    it("removing records updates group", () => {
      data.add([{ foo: 1 }, { foo: 2 }, { foo: 3 }]);
      expect(data.foo.top(Infinity)).toStrictEqual([{ foo: 3 }, { foo: 2 }, { foo: 1 }]);
      expect(data.foo.div2.all()).toStrictEqual([
        { key: 0, value: 1 },
        { key: 1, value: 2 },
      ]);
      data.foo.filterRange([1, 3]);
      data.remove();
      data.foo.filterAll();
      expect(data.foo.top(Infinity)).toStrictEqual([{ foo: 3 }]);
      expect(data.foo.div2.all()).toStrictEqual([{ key: 1, value: 1 }]);
      data.remove();
      expect(data.foo.top(Infinity)).toStrictEqual([]);
      expect(data.foo.div2.all()).toStrictEqual([]);
    });

    it("filtering works correctly after removing a record", () => {
      data.add([{ foo: 1 }, { foo: 2 }, { foo: 3 }]);
      data.foo.filter(2);
      data.remove();
      data.foo.filterAll();
      expect(data.foo.top(Infinity)).toStrictEqual([{ foo: 3 }, { foo: 1 }]);
      data.remove();
      expect(data.foo.top(Infinity)).toStrictEqual([]);
    });
  });

  describe("remove with predicate", () => {
    const createFooFixture = () => {
      const cf = crossfilter<{ foo: number }>();
      const foo = cf.dimension((d) => d.foo);
      const dimensioned = Object.assign(foo, {
        div2: foo.group((value) => Math.floor(value / 2)),
        positive: foo.group((value) => (value > 0 ? 1 : 0)),
      });
      return Object.assign(cf, {
        foo: dimensioned,
        allSum: cf.groupAll().reduceSum((d) => d.foo),
      });
    };
    let data: ReturnType<typeof createFooFixture>;

    beforeEach(() => {
      data = createFooFixture();
    });

    it("removing a record works for a group with cardinality one", () => {
      data.add([{ foo: 1 }, { foo: 1.1 }, { foo: 1.2 }]);
      data.remove((d) => d.foo === 1.1);
      expect(data.all()).toStrictEqual([{ foo: 1 }, { foo: 1.2 }]);
      data.remove(() => true);
      expect(data.foo.top(Infinity)).toStrictEqual([]);
    });

    it("removing a record works for another group with cardinality one", () => {
      data.add([{ foo: 0 }, { foo: -1 }]);
      expect(data.foo.positive.all()).toStrictEqual([{ key: 0, value: 2 }]);
      data.remove((d) => d.foo === 0);
      expect(data.foo.positive.all()).toStrictEqual([{ key: 0, value: 1 }]);
      expect(data.foo.top(Infinity)).toStrictEqual([{ foo: -1 }]);
      data.remove(() => true);
      expect(data.foo.top(Infinity)).toStrictEqual([]);
    });

    it("removing a record updates dimension", () => {
      data.add([{ foo: 1 }, { foo: 2 }]);
      data.remove((d) => d.foo === 1);
      expect(data.foo.top(Infinity)).toStrictEqual([{ foo: 2 }]);
      data.remove(() => true);
      expect(data.foo.top(Infinity)).toStrictEqual([]);
    });

    it("removing records updates group", () => {
      data.add([{ foo: 1 }, { foo: 2 }, { foo: 3 }]);
      expect(data.foo.top(Infinity)).toStrictEqual([{ foo: 3 }, { foo: 2 }, { foo: 1 }]);
      expect(data.foo.div2.all()).toStrictEqual([
        { key: 0, value: 1 },
        { key: 1, value: 2 },
      ]);
      data.remove((d) => d.foo < 3);
      expect(data.foo.top(Infinity)).toStrictEqual([{ foo: 3 }]);
      expect(data.foo.div2.all()).toStrictEqual([{ key: 1, value: 1 }]);
      data.remove(() => true);
      expect(data.foo.top(Infinity)).toStrictEqual([]);
      expect(data.foo.div2.all()).toStrictEqual([]);
    });

    it("can remove records while filtering", () => {
      data.add([{ foo: 1 }, { foo: 2 }, { foo: 3 }]);
      expect(data.allSum.value()).toBe(6);
      expect(data.foo.positive.all()).toStrictEqual([{ key: 1, value: 3 }]);
      data.foo.filter(2);
      expect(data.allSum.value()).toBe(2);
      data.remove((d) => d.foo === 3);
      expect(data.allSum.value()).toBe(2);
      expect(data.foo.positive.all()).toStrictEqual([{ key: 1, value: 2 }]);
      data.remove((d) => d.foo === 2);
      expect(data.allSum.value()).toBe(0);
      data.foo.filterAll();
      expect(data.allSum.value()).toBe(1);
      data.remove(() => true);
      expect(data.foo.top(Infinity)).toStrictEqual([]);
    });

    it("can remove records using predicate function while filtering on iterable dimension", () => {
      const data2 = crossfilter<{ foo: number[]; bar: number }>();
      const fooDimension = data2.dimension((d) => d.foo, true);
      data2.add([
        { foo: [1, 2, 3], bar: 1 },
        { foo: [1, 2], bar: 2 },
        { foo: [2, 3], bar: 4 },
      ]);
      const fooGroup = fooDimension.group();
      const allBarSum = data2.groupAll().reduceSum((d) => d.bar);
      const fooBarSum = fooDimension.group().reduceSum((d) => d.bar);

      expect(allBarSum.value()).toBe(7);
      expect(fooGroup.all()).toStrictEqual([
        { key: 1, value: 2 },
        { key: 2, value: 3 },
        { key: 3, value: 2 },
      ]);
      expect(fooBarSum.all()).toStrictEqual([
        { key: 1, value: 3 },
        { key: 2, value: 7 },
        { key: 3, value: 5 },
      ]);

      fooDimension.filter(3);
      expect(allBarSum.value()).toBe(5);

      data2.remove((d) => d.foo.indexOf(1) >= 0);
      expect(allBarSum.value()).toBe(4);
      expect(fooGroup.all()).toStrictEqual([
        { key: 2, value: 1 },
        { key: 3, value: 1 },
      ]);
      expect(fooBarSum.all()).toStrictEqual([
        { key: 2, value: 4 },
        { key: 3, value: 4 },
      ]);

      fooDimension.filterAll();
      expect(allBarSum.value()).toBe(4);

      data2.remove(() => true);
      expect(fooDimension.top(Infinity)).toStrictEqual([]);
    });
  });

  describe("onChange", () => {
    let data: Crossfilter<Sale>;

    beforeEach(() => {
      data = crossfilter(testData);
    });

    it("returns a callback function", () => {
      const cb = data.onChange(() => {});
      expect(typeof cb).toBe("function");
    });

    it("sends the eventName with the callback", () => {
      let name: EventName | undefined;
      data.onChange((n) => {
        name = n;
      });
      data.add([{ ...testData[0] }]);
      expect(name).toBe("dataAdded");
    });

    it("callback gets called when adding data", () => {
      let pass = false;
      data.onChange(() => {
        pass = true;
      });
      data.add([{ ...testData[0] }]);
      expect(pass).toBe(true);
    });

    it("callback gets called when removing all data", () => {
      let pass = false;
      data.onChange(() => {
        pass = true;
      });
      data.remove();
      expect(pass).toBe(true);
    });

    it("callback gets called when removing some data", () => {
      let num = 0;
      data.onChange(() => {
        num++;
      });
      const dateDim = data.dimension((d) => d.date);
      dateDim.filter("2011-11-14T16:54:06Z");
      data.remove();
      expect(num).toBe(2);
    });

    it("callback gets called when filtering data various ways", () => {
      let num = 0;
      data.onChange(() => {
        num++;
      });
      const totalDim = data.dimension((d) => d.total);
      totalDim.filter([30, 70]);
      totalDim.filter(55);
      totalDim.filter((d) => d % 2 === 1);
      totalDim.filter();
      expect(num).toBe(4);
    });

    it("multiple callbacks gets called in sequence of registration", () => {
      let pass1 = 0;
      let pass2 = 0;
      let pass3 = 0;
      let pass4 = 0;
      let num = 0;
      data.onChange(() => {
        pass1 = ++num;
      });
      data.onChange(() => {
        pass2 = ++num;
      });
      data.onChange(() => {
        pass3 = ++num;
      });
      data.onChange(() => {
        pass4 = ++num;
      });
      const totalDim = data.dimension((d) => d.total);
      totalDim.filter(50);
      expect(pass1).toBe(1);
      expect(pass2).toBe(2);
      expect(pass3).toBe(3);
      expect(pass4).toBe(4);
    });

    it("callback is removed when the returned function called", () => {
      let num = 0;
      const cb = data.onChange(() => {
        num++;
      });
      const totalDim = data.dimension((d) => d.total);
      totalDim.filter([30, 70]);
      totalDim.filter(55);
      cb();
      totalDim.filter((d) => d % 2 === 1);
      totalDim.filter();
      expect(num).toBe(2);
    });
  });

  describe("isElementFiltered", () => {
    it("Test if elements are filtered", () => {
      try {
        expect(data.isElementFiltered(0)).toBe(true);
        expect(data.isElementFiltered(2)).toBe(true);
        expect(data.isElementFiltered(6)).toBe(true);
        expect(data.isElementFiltered(0, [data.quantity])).toBe(true);
        expect(data.isElementFiltered(2, [data.quantity])).toBe(true);
        expect(data.isElementFiltered(6, [data.quantity])).toBe(true);
        expect(data.isElementFiltered(0, [data.total])).toBe(true);
        expect(data.isElementFiltered(2, [data.total])).toBe(true);
        expect(data.isElementFiltered(6, [data.total])).toBe(true);
        expect(data.isElementFiltered(0, [data.quantity, data.total])).toBe(true);
        expect(data.isElementFiltered(2, [data.quantity, data.total])).toBe(true);
        expect(data.isElementFiltered(6, [data.quantity, data.total])).toBe(true);

        data.quantity.filterExact(1);
        expect(data.isElementFiltered(0)).toBe(false);
        expect(data.isElementFiltered(2)).toBe(true);
        expect(data.isElementFiltered(6)).toBe(true);
        expect(data.isElementFiltered(0, [data.quantity])).toBe(true);
        expect(data.isElementFiltered(2, [data.quantity])).toBe(true);
        expect(data.isElementFiltered(6, [data.quantity])).toBe(true);
        expect(data.isElementFiltered(0, [data.total])).toBe(false);
        expect(data.isElementFiltered(2, [data.total])).toBe(true);
        expect(data.isElementFiltered(6, [data.total])).toBe(true);
        expect(data.isElementFiltered(0, [data.quantity, data.total])).toBe(true);
        expect(data.isElementFiltered(2, [data.quantity, data.total])).toBe(true);
        expect(data.isElementFiltered(6, [data.quantity, data.total])).toBe(true);

        data.total.filterExact(100);
        expect(data.isElementFiltered(0)).toBe(false);
        expect(data.isElementFiltered(2)).toBe(false);
        expect(data.isElementFiltered(6)).toBe(true);
        expect(data.isElementFiltered(0, [data.quantity])).toBe(false);
        expect(data.isElementFiltered(2, [data.quantity])).toBe(false);
        expect(data.isElementFiltered(6, [data.quantity])).toBe(true);
        expect(data.isElementFiltered(0, [data.total])).toBe(false);
        expect(data.isElementFiltered(2, [data.total])).toBe(true);
        expect(data.isElementFiltered(6, [data.total])).toBe(true);
        expect(data.isElementFiltered(0, [data.quantity, data.total])).toBe(true);
        expect(data.isElementFiltered(2, [data.quantity, data.total])).toBe(true);
        expect(data.isElementFiltered(6, [data.quantity, data.total])).toBe(true);
      } finally {
        data.quantity.filterAll();
        data.total.filterAll();
      }
    });
  });

  it("filter the 32nd dimension", () => {
    const itemBuilder = (fieldCount: number, value: string) => {
      const item: Record<string, string> = {};
      for (let i = 0; i < fieldCount; i++) {
        item["f" + (i + 1)] = value;
      }
      return item;
    };

    const dataSet = [itemBuilder(34, "a"), itemBuilder(34, "b")];
    const data = crossfilter(dataSet);

    const dimensions = Object.keys(dataSet[0]).map((key) => data.dimension((d) => d[key]));
    const groups = dimensions.map((d) => d.group());
    dimensions[31].filterExact("a");
    const correctGroupValue = [
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      1, 0, 0,
    ];
    expect(groups.map((g) => g.all()[1].value)).toStrictEqual(correctGroupValue);

    dimensions[31].filter(null);
    dimensions[31].filterExact("a");

    expect(groups.map((g) => g.all()[1].value)).toStrictEqual(correctGroupValue);
  });
});
