import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("configuration", () => {
  it("requires an explicit host and uses safe read-only defaults otherwise", () => {
    expect(() => loadConfig({})).toThrow(/CRAB_HOLE_SSH_HOST/);
    const config = loadConfig({ CRAB_HOLE_SSH_HOST: "dns.example.com" });
    expect(config.ssh.host).toBe("dns.example.com");
    expect(config.ssh.configPath).toBe("/dev/null");
    expect(config.mutationsEnabled).toBe(false);
  });

  it("enables mutations only explicitly", () => {
    const base = { CRAB_HOLE_SSH_HOST: "dns.example.com" };
    expect(loadConfig({ ...base, CRAB_HOLE_MUTATIONS_ENABLED: "true" }).mutationsEnabled).toBe(true);
    expect(loadConfig({ ...base, CRAB_HOLE_MUTATIONS_ENABLED: "false" }).mutationsEnabled).toBe(false);
  });
});
