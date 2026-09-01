import type { RuleKind } from "./domain.js";
import { assertDomain } from "./domain.js";
import type { RemoteExecutor } from "./remote.js";

export interface CrabHoleOperations {
  status(): Promise<unknown>;
  getConfig(): Promise<unknown>;
  validateCurrent(): Promise<unknown>;
  validateProposed(content: string): Promise<unknown>;
  replaceConfig(content: string, expectedSha256: string, applyNow: boolean): Promise<unknown>;
  listBackups(limit: number): Promise<unknown>;
  restoreConfig(backupId: string, applyNow: boolean): Promise<unknown>;
  serviceAction(action: "start" | "stop" | "restart"): Promise<unknown>;
  checkDomain(domain: string): Promise<unknown>;
  listRules(kind: RuleKind, limit: number): Promise<unknown>;
  listBlocklists(): Promise<unknown>;
  recentLogs(lines: number, errorsOnly: boolean): Promise<unknown>;
  addRule(kind: RuleKind, domain: string, applyNow: boolean): Promise<unknown>;
  removeRule(kind: RuleKind, domain: string, applyNow: boolean): Promise<unknown>;
  restart(): Promise<unknown>;
}

export class CrabHoleService implements CrabHoleOperations {
  constructor(private readonly remote: RemoteExecutor) {}

  status(): Promise<unknown> {
    return this.remote.run("status");
  }

  getConfig(): Promise<unknown> {
    return this.remote.run("get-config");
  }

  validateCurrent(): Promise<unknown> {
    return this.remote.run("validate-current");
  }

  validateProposed(content: string): Promise<unknown> {
    return this.remote.run("validate-proposed", [Buffer.from(content, "utf8").toString("base64")]);
  }

  replaceConfig(content: string, expectedSha256: string, applyNow: boolean): Promise<unknown> {
    return this.remote.run("replace-config", [
      Buffer.from(content, "utf8").toString("base64"),
      expectedSha256,
      String(applyNow),
    ]);
  }

  listBackups(limit: number): Promise<unknown> {
    return this.remote.run("list-backups", [String(limit)]);
  }

  restoreConfig(backupId: string, applyNow: boolean): Promise<unknown> {
    return this.remote.run("restore-config", [backupId, String(applyNow)]);
  }

  serviceAction(action: "start" | "stop" | "restart"): Promise<unknown> {
    return this.remote.run("service-action", [action]);
  }

  checkDomain(domain: string): Promise<unknown> {
    return this.remote.run("check-domain", [assertDomain(domain)]);
  }

  listRules(kind: RuleKind, limit: number): Promise<unknown> {
    return this.remote.run("list-rules", [kind, String(limit)]);
  }

  listBlocklists(): Promise<unknown> {
    return this.remote.run("list-blocklists");
  }

  recentLogs(lines: number, errorsOnly: boolean): Promise<unknown> {
    return this.remote.run("logs", [String(lines), errorsOnly ? "errors" : "all"]);
  }

  addRule(kind: RuleKind, domain: string, applyNow: boolean): Promise<unknown> {
    return this.remote.run("add-rule", [kind, assertDomain(domain, kind), String(applyNow)]);
  }

  removeRule(kind: RuleKind, domain: string, applyNow: boolean): Promise<unknown> {
    return this.remote.run("remove-rule", [kind, assertDomain(domain, kind), String(applyNow)]);
  }

  restart(): Promise<unknown> {
    return this.remote.run("restart");
  }
}
