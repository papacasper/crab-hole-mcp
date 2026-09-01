import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { AppConfig } from "./config.js";

const execFileAsync = promisify(execFile);

export interface RemoteExecutor {
  run(command: string, args?: string[]): Promise<unknown>;
}

export class SshRemoteExecutor implements RemoteExecutor {
  constructor(private readonly config: AppConfig["ssh"]) {}

  async run(command: string, args: string[] = []): Promise<unknown> {
    const sshArgs = [
      "-F",
      this.config.configPath,
      "-o",
      "BatchMode=yes",
      "-o",
      "ConnectTimeout=10",
      `${this.config.user}@${this.config.host}`,
      "sudo",
      "-n",
      this.config.helperPath,
      command,
      ...args,
    ];
    const { stdout } = await execFileAsync("ssh", sshArgs, {
      timeout: this.config.timeoutMs,
      maxBuffer: 4 * 1024 * 1024,
      encoding: "utf8",
    });
    const trimmed = stdout.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      throw new Error(`Remote helper returned invalid JSON: ${trimmed.slice(0, 500)}`);
    }
  }
}
