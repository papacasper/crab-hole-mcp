#!/usr/bin/env node
import "dotenv/config";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { createCrabHoleMcpServer } from "./server.js";

async function main() {
  const server = createCrabHoleMcpServer(loadConfig());
  const transport = new StdioServerTransport();
  process.on("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
