import { describe, expect, it } from "vitest";
import { assertDomain, isValidDomain, normalizeDomain } from "../src/domain.js";

describe("domain validation", () => {
  it("normalizes case and a trailing dot", () => {
    expect(normalizeDomain(" Example.COM. ")).toBe("example.com");
  });

  it("accepts normal domains and allow wildcards", () => {
    expect(isValidDomain("example.com")).toBe(true);
    expect(isValidDomain("*.example.com", true)).toBe(true);
    expect(assertDomain("*.Example.com", "allow")).toBe("*.example.com");
  });

  it("rejects shell metacharacters, invalid labels, and wildcard blocks", () => {
    expect(isValidDomain("example.com;id")).toBe(false);
    expect(isValidDomain("-bad.example")).toBe(false);
    expect(() => assertDomain("*.example.com", "block")).toThrow();
  });
});
