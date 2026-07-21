import { config as loadDotenv } from "dotenv";
import { resetEnvConfig } from "../cli/configFile";
import { promptForConfig } from "../cli/prompts";
import { ConfigurationError } from "./errors";
import { isInteractive } from "./helpers";
import type { CliArgs } from "./types";

export type AppConfig = {
  apiKey: string;
  baseUrl: string;
  defaultOutput: string;
  sslVerify: boolean;
  concurrency: number;
  maxRetries: number;
  downloadTimeout: number;
  saveConfig?: boolean;
  serverInfo?: string;
};

const defaults = {
  defaultOutput: "./downloads",
  sslVerify: true,
  concurrency: 5,
  maxRetries: 3,
  downloadTimeout: 30000,
};

const optionalFromEnv = (env: NodeJS.ProcessEnv) => ({
  defaultOutput: env.DEFAULT_OUTPUT,
  sslVerify: env.IMMICH_SSL_VERIFY === undefined ? undefined : env.IMMICH_SSL_VERIFY !== "false",
  concurrency: parseNumber(env.IMMICH_CONCURRENCY),
  maxRetries: parseNumber(env.IMMICH_MAX_RETRIES),
  downloadTimeout: parseNumber(env.IMMICH_DOWNLOAD_TIMEOUT),
});

const configFromArgv = (argv: Partial<CliArgs>) => ({
  apiKey: argv["api-key"],
  baseUrl: argv["base-url"],
  defaultOutput: argv.output,
  concurrency: argv.concurrency,
  maxRetries: argv["max-retries"],
});

function parseNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function firstDefined<T>(...values: (T | undefined)[]): T | undefined {
  return values.find((value) => value !== undefined);
}

export function validateConfig(input: Partial<AppConfig>, env = process.env): AppConfig {
  if (!input.apiKey) {
    throw new ConfigurationError(
      "Missing IMMICH_API_KEY. Set --api-key, IMMICH_API_KEY, or run interactively to configure it. Example: immich-album-downloader --base-url https://immich.example.com --api-key your-api-key --all"
    );
  }

  if (input.apiKey.length < 10) {
    throw new ConfigurationError("IMMICH_API_KEY appears to be invalid (too short)");
  }

  if (!input.baseUrl) {
    throw new ConfigurationError(
      "Missing IMMICH_BASE_URL. Set --base-url, IMMICH_BASE_URL, or run interactively to configure it. Example: immich-album-downloader --base-url https://immich.example.com --api-key your-api-key --all"
    );
  }

  let baseUrl: URL;
  try {
    baseUrl = new URL(input.baseUrl);
  } catch {
    throw new ConfigurationError(`IMMICH_BASE_URL must be a valid URL. Got: ${input.baseUrl}`);
  }

  if (env.NODE_ENV === "production" && baseUrl.protocol !== "https:") {
    const allowInsecure = env.IMMICH_ALLOW_INSECURE_HTTP === "true";

    if (!allowInsecure) {
      throw new ConfigurationError(
        "IMMICH_BASE_URL must use HTTPS in production environment. Set IMMICH_ALLOW_INSECURE_HTTP=true to allow HTTP for internal/private networks."
      );
    }
  }

  const config = {
    apiKey: input.apiKey,
    baseUrl: baseUrl.href.replace(/\/+$/, ""),
    defaultOutput: input.defaultOutput ?? defaults.defaultOutput,
    sslVerify: input.sslVerify ?? defaults.sslVerify,
    concurrency: input.concurrency ?? defaults.concurrency,
    maxRetries: input.maxRetries ?? defaults.maxRetries,
    downloadTimeout: input.downloadTimeout ?? defaults.downloadTimeout,
  };

  if (config.concurrency < 1 || config.concurrency > 50) {
    throw new ConfigurationError("IMMICH_CONCURRENCY must be between 1 and 50");
  }

  if (config.maxRetries < 0 || config.maxRetries > 10) {
    throw new ConfigurationError("IMMICH_MAX_RETRIES must be between 0 and 10");
  }

  if (config.downloadTimeout < 5000 || config.downloadTimeout > 600000) {
    throw new ConfigurationError("IMMICH_DOWNLOAD_TIMEOUT must be between 5000 and 600000 ms");
  }

  return config;
}

export async function resolveConfig(
  argv: Partial<CliArgs> = {},
  env = process.env
): Promise<AppConfig> {
  loadDotenv({ override: false });

  if (argv["reset-config"]) resetEnvConfig();

  const args = configFromArgv(argv);
  const fromEnv = {
    apiKey: env.IMMICH_API_KEY,
    baseUrl: env.IMMICH_BASE_URL,
    ...optionalFromEnv(env),
  };

  const merged = {
    apiKey: firstDefined(args.apiKey, fromEnv.apiKey),
    baseUrl: firstDefined(args.baseUrl, fromEnv.baseUrl),
    defaultOutput: firstDefined(args.defaultOutput, fromEnv.defaultOutput, defaults.defaultOutput),
    sslVerify: firstDefined(fromEnv.sslVerify, defaults.sslVerify),
    concurrency: firstDefined(args.concurrency, fromEnv.concurrency, defaults.concurrency),
    maxRetries: firstDefined(args.maxRetries, fromEnv.maxRetries, defaults.maxRetries),
    downloadTimeout: firstDefined(fromEnv.downloadTimeout, defaults.downloadTimeout),
    saveConfig: argv["save-config"],
  };

  if ((!merged.apiKey || !merged.baseUrl) && isInteractive(argv)) {
    const prompted = await promptForConfig(merged);
    const config = validateConfig({ ...merged, ...prompted }, env);
    config.saveConfig = prompted.saveConfig;
    return config;
  }

  const config = validateConfig(merged, env);
  config.saveConfig = merged.saveConfig;
  return config;
}
