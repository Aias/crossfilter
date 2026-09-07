import { describe, expect, it } from "vitest";
import crossfilter from "../index.ts";
import { version } from "../package.json";

describe("version", () => {
  it("matches the package version", () => {
    expect(crossfilter.version).toBe(version);
  });
});
