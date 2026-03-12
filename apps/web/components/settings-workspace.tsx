"use client";

import type { SystemStatus } from "@seo-localization/shared";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import { updateSystemConfig } from "../lib/api-actions";

interface SettingsWorkspaceProps {
  systemStatus: SystemStatus;
}

const providerOptions = [
  { value: "openrouter", label: "OpenRouter", description: "适合接入更便宜的第三方模型" },
  { value: "siliconflow", label: "SiliconFlow", description: "适合国内可用的兼容模型接口" },
  { value: "gemini", label: "Gemini", description: "原生接入 Google Gemini generateContent 接口" },
  { value: "openai", label: "OpenAI", description: "官方接口，成本通常更高" },
  { value: "custom-compatible", label: "自定义兼容接口", description: "任何兼容 OpenAI Chat Completions 的服务" },
  { value: "mock", label: "Mock（仅本地演示）", description: "不发真实请求，只做演示流程" }
] as const;

const providerPlaceholders: Record<string, { model: string; apiBaseUrl: string }> = {
  openrouter: {
    model: "deepseek/deepseek-chat-v3-0324:free",
    apiBaseUrl: "https://openrouter.ai/api/v1"
  },
  siliconflow: {
    model: "Qwen/Qwen2.5-72B-Instruct",
    apiBaseUrl: "https://api.siliconflow.cn/v1"
  },
  gemini: {
    model: "gemini-2.0-flash",
    apiBaseUrl: "https://generativelanguage.googleapis.com"
  },
  openai: {
    model: "gpt-5-mini",
    apiBaseUrl: "https://api.openai.com/v1"
  },
  "custom-compatible": {
    model: "your-model-name",
    apiBaseUrl: "https://your-provider.example.com/v1"
  },
  mock: {
    model: "mock-model",
    apiBaseUrl: ""
  }
};

export function SettingsWorkspace({ systemStatus }: SettingsWorkspaceProps) {
  const router = useRouter();
  const [translationProvider, setTranslationProvider] = useState(systemStatus.translationProvider);
  const [model, setModel] = useState(systemStatus.model);
  const [apiBaseUrl, setApiBaseUrl] = useState(systemStatus.apiBaseUrl);
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const selectedProviderMeta = providerOptions.find((provider) => provider.value === translationProvider);
  const isMockProvider = translationProvider === "mock";

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSaving(true);

    try {
      await updateSystemConfig({
        translationProvider,
        model,
        apiKey,
        apiBaseUrl
      });
      setApiKey("");
      setMessage("配置已保存，后续翻译请求会直接使用新的后端设置。");
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "保存配置失败。");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleClearKey() {
    setError(null);
    setMessage(null);
    setIsClearing(true);

    try {
      await updateSystemConfig({
        translationProvider,
        model,
        apiBaseUrl,
        clearApiKey: true
      });
      setApiKey("");
      setMessage("已清除已保存的 API Key。");
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "清除 API Key 失败。");
    } finally {
      setIsClearing(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <section className="ui-panel p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="ui-kicker">Model Access</p>
            <h3 className="mt-3 text-2xl">在前端直接配置 AI Provider</h3>
          </div>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSave}>
          <label className="block">
            <span className="ui-label">翻译 Provider</span>
            <select
              className="ui-select"
              value={translationProvider}
              onChange={(event) => {
                const nextProvider = event.target.value;
                const nextPreset = providerPlaceholders[nextProvider] ?? providerPlaceholders["custom-compatible"];
                setTranslationProvider(nextProvider);

                if (!model.trim() || model === (providerPlaceholders[translationProvider]?.model ?? "")) {
                  setModel(nextPreset.model);
                }

                if (nextProvider === "mock") {
                  setApiBaseUrl("");
                } else if (!apiBaseUrl.trim() || apiBaseUrl === (providerPlaceholders[translationProvider]?.apiBaseUrl ?? "")) {
                  setApiBaseUrl(nextPreset.apiBaseUrl);
                }
              }}
            >
              {providerOptions.map((provider) => (
                <option key={provider.value} value={provider.value}>
                  {provider.label}
                </option>
              ))}
            </select>
            <span className="mt-2 block text-xs leading-6 text-ink/55">
              {selectedProviderMeta?.description}
            </span>
          </label>

          <label className="block">
            <span className="ui-label">模型名称</span>
            <input
              className="ui-input"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder={providerPlaceholders[translationProvider]?.model ?? "输入模型名"}
            />
          </label>

          {!isMockProvider ? (
            <label className="block">
              <span className="ui-label">接口 Base URL</span>
              <input
                className="ui-input ui-mono"
                value={apiBaseUrl}
                onChange={(event) => setApiBaseUrl(event.target.value)}
                placeholder={providerPlaceholders[translationProvider]?.apiBaseUrl ?? "https://.../v1"}
              />
            </label>
          ) : null}

          <label className="block">
            <span className="ui-label">
              {isMockProvider ? "演示模式无需 API Key" : "API Key"}
            </span>
            <input
              type="password"
              className="ui-input ui-mono"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={
                isMockProvider
                  ? "Mock 模式可留空"
                  : systemStatus.apiKeyConfigured
                    ? "已保存，如需替换请重新输入"
                    : "输入 Provider API Key"
              }
              disabled={isMockProvider}
            />
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="ui-button"
            >
              {isSaving ? "保存中..." : "保存配置"}
            </button>
            <button
              type="button"
              onClick={handleClearKey}
              disabled={isClearing || !systemStatus.apiKeyConfigured || isMockProvider}
              className="ui-button-secondary"
            >
              {isClearing ? "清除中..." : "清除已保存 Key"}
            </button>
          </div>

          {message ? <p className="text-sm text-leaf">{message}</p> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </form>
      </section>

      <section className="ui-panel p-6">
        <p className="ui-kicker">Runtime</p>
        <h3 className="mt-3 text-2xl">运行时配置</h3>

        <div className="mt-6 grid gap-4">
          <article className="ui-panel-muted p-5">
            <p className="ui-kicker">翻译状态</p>
            <p className="mt-3 text-sm text-ink/72">Provider：{systemStatus.translationProvider}</p>
            <p className="mt-2 text-sm text-ink/72">
              API Key：{systemStatus.apiKeyConfigured ? "已保存到本地配置文件" : "未配置"}
            </p>
            <p className="mt-2 text-sm text-ink/72">Model：{systemStatus.model}</p>
            <p className="ui-mono mt-2 break-all text-sm text-ink/72">
              Base URL：{systemStatus.apiBaseUrl || "Mock 模式无需配置"}
            </p>
          </article>

          <article className="ui-panel-muted p-5">
            <p className="ui-kicker">配置文件路径</p>
            <p className="ui-mono mt-3 break-all text-sm text-ink/72">{systemStatus.configFile}</p>
          </article>

          <article className="ui-panel-muted p-5">
            <p className="ui-kicker">运行目录</p>
            <p className="ui-mono mt-3 break-all text-sm text-ink/72">状态文件：{systemStatus.stateFile}</p>
            <p className="ui-mono mt-2 break-all text-sm text-ink/72">导出目录：{systemStatus.exportRoot}</p>
          </article>

          <article className="ui-panel-muted p-5">
            <p className="ui-kicker">下一步</p>
            <p className="mt-3 text-sm leading-7 text-ink/72">
              配置完成后回到工作台，按接入代码、检查抽取、生成草稿、人工校对、回写代码这条线往下走就可以。
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/" className="ui-button">
                回到工作台
              </Link>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
