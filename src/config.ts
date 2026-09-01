import { z } from "zod";

const enabledFromEnv = z
  .string()
  .optional()
  .transform((value) => value?.toLowerCase() === "true");

const envSchema = z.object({
  CRAB_HOLE_SSH_HOST: z.string().min(1),
  CRAB_HOLE_SSH_USER: z.string().regex(/^[a-z_][a-z0-9_-]*$/i).default("ubuntu"),
  CRAB_HOLE_SSH_CONFIG: z.string().startsWith("/").default("/dev/null"),
  CRAB_HOLE_REMOTE_HELPER: z
    .string()
    .startsWith("/")
    .default("/usr/local/sbin/crab-hole-admin"),
  CRAB_HOLE_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(180_000).default(90_000),
  CRAB_HOLE_MUTATIONS_ENABLED: enabledFromEnv,
});

export type AppConfig = {
  ssh: {
    host: string;
    user: string;
    configPath: string;
    helperPath: string;
    timeoutMs: number;
  };
  mutationsEnabled: boolean;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid configuration: ${details}`);
  }

  const value = result.data;
  return {
    ssh: {
      host: value.CRAB_HOLE_SSH_HOST,
      user: value.CRAB_HOLE_SSH_USER,
      configPath: value.CRAB_HOLE_SSH_CONFIG,
      helperPath: value.CRAB_HOLE_REMOTE_HELPER,
      timeoutMs: value.CRAB_HOLE_TIMEOUT_MS,
    },
    mutationsEnabled: value.CRAB_HOLE_MUTATIONS_ENABLED,
  };
}
