import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../src/config.js";
import { createCrabHoleMcpServer } from "../src/server.js";

const baseConfig: AppConfig = {
  ssh: {
    host: "example.test",
    user: "ubuntu",
    configPath: "/dev/null",
    helperPath: "/usr/local/sbin/crab-hole-admin",
    timeoutMs: 90_000,
  },
  mutationsEnabled: false,
};

const fakeOperations = {
  status: vi.fn(async () => ({ active: true })),
  getConfig: vi.fn(async () => ({
    sha256: "a".repeat(64),
    encoding: "base64",
    content: Buffer.from("[blocklist]\nblocking_mode = \"zero\"\n").toString("base64"),
  })),
  validateCurrent: vi.fn(async () => ({ configValid: true, listsValid: true })),
  validateProposed: vi.fn(async () => ({ valid: true })),
  replaceConfig: vi.fn(async () => ({ changed: true })),
  listBackups: vi.fn(async () => ({ entries: [] })),
  restoreConfig: vi.fn(async () => ({ restored: true })),
  serviceAction: vi.fn(async () => ({ active: true })),
  checkDomain: vi.fn(async (domain: string) => ({ domain, blocked: true })),
  listRules: vi.fn(async () => ({ entries: [] })),
  listBlocklists: vi.fn(async () => ({ blocklists: [] })),
  recentLogs: vi.fn(async () => ({ logs: [] })),
  addRule: vi.fn(async () => ({ changed: true })),
  removeRule: vi.fn(async () => ({ changed: true })),
  restart: vi.fn(async () => ({ active: true })),
};

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  await Promise.all(closers.splice(0).map((close) => close()));
  vi.clearAllMocks();
});

async function connect(config: AppConfig) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createCrabHoleMcpServer(config, fakeOperations);
  const client = new Client({ name: "test-client", version: "1.0.0" });
  closers.push(() => client.close(), () => server.close());
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

describe("Crab-hole MCP server", () => {
  it("advertises only read-only tools by default", async () => {
    const client = await connect(baseConfig);
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toEqual([
      "get_crab_hole_config",
      "validate_crab_hole",
      "validate_proposed_config",
      "list_config_backups",
      "crab_hole_status",
      "check_domain",
      "list_custom_rules",
      "list_blocklists",
      "recent_logs",
    ]);
    expect(tools.tools.every((tool) => tool.annotations?.readOnlyHint === true)).toBe(true);
  });

  it("requires exact confirmation before mutations", async () => {
    const client = await connect({ ...baseConfig, mutationsEnabled: true });
    const response = await client.callTool({
      name: "add_custom_rule",
      arguments: {
        kind: "block",
        domain: "example.com",
        applyNow: false,
        confirmation: "yes",
      },
    });
    expect(response.isError).toBe(true);
    expect(fakeOperations.addRule).not.toHaveBeenCalled();
  });

  it("decodes the remote configuration and exposes its revision", async () => {
    const client = await connect(baseConfig);
    const response = await client.callTool({ name: "get_crab_hole_config", arguments: {} });
    expect(response.structuredContent).toEqual({
      data: {
        sha256: "a".repeat(64),
        encoding: "utf8",
        content: "[blocklist]\nblocking_mode = \"zero\"\n",
      },
    });
  });

  it("requires the active hash in configuration replacement confirmation", async () => {
    const client = await connect({ ...baseConfig, mutationsEnabled: true });
    const hash = "a".repeat(64);
    await client.callTool({
      name: "replace_crab_hole_config",
      arguments: {
        toml: "[blocklist]\nblocking_mode = \"zero\"\n",
        expectedSha256: hash,
        applyNow: false,
        confirmation: `REPLACE CRAB-HOLE CONFIG ${hash}`,
      },
    });
    expect(fakeOperations.replaceConfig).toHaveBeenCalledWith(
      "[blocklist]\nblocking_mode = \"zero\"\n",
      hash,
      false,
    );
  });

  it("guards service stop with an exact action confirmation", async () => {
    const client = await connect({ ...baseConfig, mutationsEnabled: true });
    const rejected = await client.callTool({
      name: "control_crab_hole_service",
      arguments: { action: "stop", confirmation: "yes" },
    });
    expect(rejected.isError).toBe(true);
    expect(fakeOperations.serviceAction).not.toHaveBeenCalled();
  });

  it("calls the domain checker with a normalized domain", async () => {
    const client = await connect(baseConfig);
    await client.callTool({ name: "check_domain", arguments: { domain: "Example.COM." } });
    expect(fakeOperations.checkDomain).toHaveBeenCalledWith("example.com");
  });
});
