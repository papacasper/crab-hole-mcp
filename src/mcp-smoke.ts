import "dotenv/config";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: `${process.cwd()}/bin/crab-hole-mcp`,
  cwd: process.cwd(),
  stderr: "inherit",
});
const client = new Client({ name: "crab-hole-smoke", version: "0.1.0" });

try {
  console.error("[smoke] connecting");
  await client.connect(transport);
  console.error("[smoke] listing tools");
  const tools = await client.listTools();
  console.error("[smoke] reading complete configuration revision");
  const config = await client.callTool({ name: "get_crab_hole_config", arguments: {} });
  console.error("[smoke] listing backups");
  const backups = await client.callTool({ name: "list_config_backups", arguments: { limit: 5 } });
  console.error("[smoke] reading status");
  const status = await client.callTool({ name: "crab_hole_status", arguments: {} });
  console.error("[smoke] checking blocked domain");
  const blocked = await client.callTool({
    name: "check_domain",
    arguments: { domain: "doubleclick.net" },
  });
  let serviceControl: unknown = null;
  if (process.env.CRAB_HOLE_SMOKE_RESTART === "true") {
    console.error("[smoke] exercising guarded service restart");
    serviceControl = await client.callTool({
      name: "control_crab_hole_service",
      arguments: { action: "restart", confirmation: "RESTART CRAB-HOLE" },
    });
  }
  console.log(
    JSON.stringify(
      {
        tools: tools.tools.map((tool) => tool.name),
        config: config.content,
        backups: backups.content,
        status: status.content,
        blocked: blocked.content,
        serviceControl,
      },
      null,
      2,
    ),
  );
} finally {
  await client.close();
}
