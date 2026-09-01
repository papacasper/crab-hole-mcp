import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AppConfig } from "./config.js";
import { assertDomain } from "./domain.js";
import { SshRemoteExecutor } from "./remote.js";
import { CrabHoleService, type CrabHoleOperations } from "./service.js";

function result(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
    structuredContent: { data: value },
  };
}

function requireConfirmation(actual: string, expected: string): void {
  if (actual !== expected) {
    throw new Error(`Confirmation mismatch. Required exactly: ${expected}`);
  }
}

function decodeConfigResult(value: unknown): unknown {
  if (
    typeof value === "object" &&
    value !== null &&
    "encoding" in value &&
    value.encoding === "base64" &&
    "content" in value &&
    typeof value.content === "string"
  ) {
    return { ...value, encoding: "utf8", content: Buffer.from(value.content, "base64").toString("utf8") };
  }
  return value;
}

const ruleKind = z.enum(["allow", "block"]);
const domainField = z.string().min(3).max(255).describe("A DNS name such as example.com");

export function createCrabHoleMcpServer(
  config: AppConfig,
  operations?: CrabHoleOperations,
): McpServer {
  const crab = operations ?? new CrabHoleService(new SshRemoteExecutor(config.ssh));
  const server = new McpServer(
    { name: "crab-hole", version: "1.0.0" },
    {
      instructions:
        "Fully administer the PapaCasper Crab-hole DNS filter. Read and validate before changing configuration. All mutations require exact confirmation, create backups where applicable, and configuration writes use an expected SHA-256 to prevent stale overwrites. applyNow=true restarts Crab-hole and verifies readiness; failed starts roll back automatically. Never expose SSH material or use these tools for unrelated server changes.",
    },
  );

  server.registerTool(
    "get_crab_hole_config",
    {
      title: "Get Crab-hole Configuration",
      description: "Read the complete active Crab-hole TOML configuration and its SHA-256 revision.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async () => result(decodeConfigResult(await crab.getConfig())),
  );

  server.registerTool(
    "validate_crab_hole",
    {
      title: "Validate Active Crab-hole State",
      description: "Run Crab-hole's native configuration and list validators without changing anything.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async () => result(await crab.validateCurrent()),
  );

  server.registerTool(
    "validate_proposed_config",
    {
      title: "Validate Proposed Configuration",
      description: "Validate complete proposed Crab-hole TOML without installing or activating it.",
      inputSchema: { toml: z.string().min(1).max(49_152) },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async ({ toml }) => result(await crab.validateProposed(toml)),
  );

  server.registerTool(
    "list_config_backups",
    {
      title: "List Crab-hole Backups",
      description: "List configuration and custom-rule backups created by this MCP.",
      inputSchema: { limit: z.number().int().min(1).max(200).default(50) },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async ({ limit }) => result(await crab.listBackups(limit)),
  );

  server.registerTool(
    "crab_hole_status",
    {
      title: "Crab-hole Status",
      description:
        "Inspect service health, version, current block count, rule counts, memory, and the latest blocklist refresh.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async () => result(await crab.status()),
  );

  server.registerTool(
    "check_domain",
    {
      title: "Check Domain",
      description:
        "Resolve a domain through the live Crab-hole backend and report whether it is blocked.",
      inputSchema: { domain: domainField },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async ({ domain }) => result(await crab.checkDomain(assertDomain(domain))),
  );

  server.registerTool(
    "list_custom_rules",
    {
      title: "List Custom Rules",
      description: "List custom allow or block entries currently stored on the DNS server.",
      inputSchema: {
        kind: ruleKind,
        limit: z.number().int().min(1).max(5_000).default(200),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async ({ kind, limit }) => result(await crab.listRules(kind, limit)),
  );

  server.registerTool(
    "list_blocklists",
    {
      title: "List Blocklists",
      description: "List the live and local blocklist sources configured in Crab-hole.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async () => result(await crab.listBlocklists()),
  );

  server.registerTool(
    "recent_logs",
    {
      title: "Recent Crab-hole Logs",
      description: "Read recent Crab-hole service logs, optionally restricted to errors.",
      inputSchema: {
        lines: z.number().int().min(1).max(500).default(100),
        errorsOnly: z.boolean().default(false),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async ({ lines, errorsOnly }) => result(await crab.recentLogs(lines, errorsOnly)),
  );

  if (config.mutationsEnabled) {
    server.registerTool(
      "replace_crab_hole_config",
      {
        title: "Replace Crab-hole Configuration",
        description:
          "Atomically replace the complete TOML configuration. The expected hash prevents stale writes. Native validation runs first, a backup is created, and applyNow rolls back if readiness fails. Confirmation must be REPLACE CRAB-HOLE CONFIG followed by the expected hash.",
        inputSchema: {
          toml: z.string().min(1).max(49_152),
          expectedSha256: z.string().regex(/^[a-f0-9]{64}$/),
          applyNow: z.boolean().default(true),
          confirmation: z.string().min(1),
        },
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
      },
      async ({ toml, expectedSha256, applyNow, confirmation }) => {
        requireConfirmation(confirmation, `REPLACE CRAB-HOLE CONFIG ${expectedSha256}`);
        return result(await crab.replaceConfig(toml, expectedSha256, applyNow));
      },
    );

    server.registerTool(
      "restore_crab_hole_config",
      {
        title: "Restore Crab-hole Configuration",
        description:
          "Restore a validated configuration backup, first backing up the current file. Confirmation must be RESTORE CRAB-HOLE CONFIG followed by the backup id.",
        inputSchema: {
          backupId: z.string().regex(/^config\.toml\.[A-Za-z0-9._-]+$/),
          applyNow: z.boolean().default(true),
          confirmation: z.string().min(1),
        },
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
      },
      async ({ backupId, applyNow, confirmation }) => {
        requireConfirmation(confirmation, `RESTORE CRAB-HOLE CONFIG ${backupId}`);
        return result(await crab.restoreConfig(backupId, applyNow));
      },
    );

    server.registerTool(
      "control_crab_hole_service",
      {
        title: "Control Crab-hole Service",
        description:
          "Start, stop, or restart Crab-hole. Stopping interrupts filtered DNS. Confirmation must be START CRAB-HOLE, STOP CRAB-HOLE, or RESTART CRAB-HOLE.",
        inputSchema: {
          action: z.enum(["start", "stop", "restart"]),
          confirmation: z.string().min(1),
        },
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
      },
      async ({ action, confirmation }) => {
        requireConfirmation(confirmation, `${action.toUpperCase()} CRAB-HOLE`);
        return result(await crab.serviceAction(action));
      },
    );

    server.registerTool(
      "add_custom_rule",
      {
        title: "Add Custom DNS Rule",
        description:
          "Add a custom allow or block rule. Confirmation must be exactly ADD ALLOW domain or ADD BLOCK domain. applyNow restarts Crab-hole and may briefly interrupt DNS.",
        inputSchema: {
          kind: ruleKind,
          domain: domainField,
          applyNow: z.boolean().default(false),
          confirmation: z.string().min(1),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
      },
      async ({ kind, domain, applyNow, confirmation }) => {
        const normalized = assertDomain(domain, kind);
        requireConfirmation(confirmation, `ADD ${kind.toUpperCase()} ${normalized}`);
        return result(await crab.addRule(kind, normalized, applyNow));
      },
    );

    server.registerTool(
      "remove_custom_rule",
      {
        title: "Remove Custom DNS Rule",
        description:
          "Remove a custom allow or block rule. Confirmation must be exactly REMOVE ALLOW domain or REMOVE BLOCK domain. applyNow restarts Crab-hole and may briefly interrupt DNS.",
        inputSchema: {
          kind: ruleKind,
          domain: domainField,
          applyNow: z.boolean().default(false),
          confirmation: z.string().min(1),
        },
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
      },
      async ({ kind, domain, applyNow, confirmation }) => {
        const normalized = assertDomain(domain, kind);
        requireConfirmation(confirmation, `REMOVE ${kind.toUpperCase()} ${normalized}`);
        return result(await crab.removeRule(kind, normalized, applyNow));
      },
    );

    server.registerTool(
      "restart_crab_hole",
      {
        title: "Restart Crab-hole",
        description:
          "Restart Crab-hole to force an immediate list reload. This can briefly interrupt filtered DNS. Confirmation must be exactly RESTART CRAB-HOLE.",
        inputSchema: { confirmation: z.string().min(1) },
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
      },
      async ({ confirmation }) => {
        requireConfirmation(confirmation, "RESTART CRAB-HOLE");
        return result(await crab.serviceAction("restart"));
      },
    );
  }

  return server;
}
