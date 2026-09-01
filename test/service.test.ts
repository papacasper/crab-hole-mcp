import { describe, expect, it, vi } from "vitest";
import { CrabHoleService } from "../src/service.js";

describe("CrabHoleService", () => {
  it("normalizes and constrains remote arguments", async () => {
    const run = vi.fn(async () => ({ ok: true }));
    const service = new CrabHoleService({ run });
    await service.checkDomain("Example.COM.");
    await service.addRule("allow", "*.Example.COM", false);
    await service.replaceConfig("[blocklist]\n", "a".repeat(64), true);
    expect(run).toHaveBeenNthCalledWith(1, "check-domain", ["example.com"]);
    expect(run).toHaveBeenNthCalledWith(2, "add-rule", ["allow", "*.example.com", "false"]);
    expect(run).toHaveBeenNthCalledWith(3, "replace-config", [
      Buffer.from("[blocklist]\n").toString("base64"),
      "a".repeat(64),
      "true",
    ]);
  });
});
