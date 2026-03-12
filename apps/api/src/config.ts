import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "../../..");
const envFile = path.join(workspaceRoot, ".env");
if (fs.existsSync(envFile)) {
  process.loadEnvFile(envFile);
}
const dataRoot = path.join(workspaceRoot, "runtime");
const systemConfigFile = path.join(dataRoot, "system-config.json");

type TranslationProvider = "openai" | "openrouter" | "siliconflow" | "gemini" | "custom-compatible" | "mock";

export const config = {
  port: Number(process.env.API_PORT ?? 3001),
  host: process.env.API_HOST ?? "0.0.0.0",
  dataRoot,
  stateFile: path.join(dataRoot, "app-state.json"),
  exportRoot: path.join(dataRoot, "exports"),
  translationProvider: (process.env.TRANSLATION_PROVIDER ?? "openai") as TranslationProvider,
  apiKey: process.env.TRANSLATION_API_KEY ?? process.env.OPENAI_API_KEY ?? "",
  model: process.env.TRANSLATION_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-5",
  apiBaseUrl: process.env.TRANSLATION_API_BASE_URL ?? resolveProviderBaseUrl(process.env.TRANSLATION_PROVIDER ?? "openai")
};

loadRuntimeConfig();

export function getSystemStatus() {
  return {
    translationProvider: config.translationProvider,
    apiKeyConfigured: Boolean(config.apiKey),
    model: config.model,
    apiBaseUrl: config.apiBaseUrl,
    canTranslate:
      config.translationProvider === "mock" ||
      Boolean(config.apiKey && config.apiBaseUrl && config.model),
    configFile: systemConfigFile,
    exportRoot: config.exportRoot,
    stateFile: config.stateFile
  };
}

export function updateSystemConfig(input: {
  translationProvider?: TranslationProvider;
  apiKey?: string;
  model?: string;
  apiBaseUrl?: string;
  clearApiKey?: boolean;
}) {
  if (input.translationProvider) {
    config.translationProvider = input.translationProvider;
    if (!input.apiBaseUrl) {
      config.apiBaseUrl = resolveProviderBaseUrl(input.translationProvider);
    }
  }

  if (typeof input.model === "string" && input.model.trim()) {
    config.model = input.model.trim();
  }

  if (typeof input.apiBaseUrl === "string" && input.apiBaseUrl.trim()) {
    config.apiBaseUrl = input.apiBaseUrl.trim().replace(/\/$/, "");
  }

  if (input.clearApiKey) {
    config.apiKey = "";
  } else if (typeof input.apiKey === "string" && input.apiKey.trim()) {
    config.apiKey = input.apiKey.trim();
  }

  persistRuntimeConfig();
  return getSystemStatus();
}

function loadRuntimeConfig() {
  if (!fs.existsSync(systemConfigFile)) {
    return;
  }

  const content = fs.readFileSync(systemConfigFile, "utf8");
  const saved = JSON.parse(content) as {
    translationProvider?: TranslationProvider;
    apiKey?: string;
    model?: string;
    apiBaseUrl?: string;
  };

  if (saved.translationProvider) {
    config.translationProvider = saved.translationProvider;
  }

  if (typeof saved.apiKey === "string") {
    config.apiKey = saved.apiKey;
  }

  if (saved.model) {
    config.model = saved.model;
  }

  if (saved.apiBaseUrl) {
    config.apiBaseUrl = saved.apiBaseUrl;
  }
}

function persistRuntimeConfig() {
  fs.mkdirSync(path.dirname(systemConfigFile), { recursive: true });
  const payload = {
    translationProvider: config.translationProvider,
    apiKey: config.apiKey,
    model: config.model,
    apiBaseUrl: config.apiBaseUrl
  };
  const nextFile = `${systemConfigFile}.tmp`;
  fs.writeFileSync(nextFile, JSON.stringify(payload, null, 2), "utf8");
  fs.renameSync(nextFile, systemConfigFile);
}

function resolveProviderBaseUrl(provider: string): string {
  switch (provider) {
    case "gemini":
      return "https://generativelanguage.googleapis.com";
    case "openrouter":
      return "https://openrouter.ai/api/v1";
    case "siliconflow":
      return "https://api.siliconflow.cn/v1";
    case "custom-compatible":
      return "";
    case "mock":
      return "";
    case "openai":
    default:
      return "https://api.openai.com/v1";
  }
}
