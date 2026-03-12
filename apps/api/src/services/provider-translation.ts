import { config } from "../config.js";

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

const TRANSLATION_TIMEOUT_MS = 300_000;
const SYSTEM_PROMPT =
  "You translate SEO landing page schemas and return valid JSON only. Preserve the schema shape exactly.";

export async function translateWithProvider(prompt: string): Promise<string> {
  if (!config.apiKey) {
    throw new Error("TRANSLATION_API_KEY is not configured.");
  }

  if (!config.apiBaseUrl) {
    throw new Error("TRANSLATION_API_BASE_URL is not configured.");
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
    "Content-Type": "application/json"
  };

  // OpenRouter benefits from optional attribution headers, but they are not required.
  if (config.translationProvider === "openrouter") {
    headers["HTTP-Referer"] = "http://localhost:3000";
    headers["X-Title"] = "AI SEO Localization Tool";
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TRANSLATION_TIMEOUT_MS);

  let response: Response;
  try {
    response =
      config.translationProvider === "gemini"
        ? await fetch(buildGeminiRequestUrl(), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": config.apiKey
            },
            signal: controller.signal,
            body: JSON.stringify({
              systemInstruction: {
                parts: [{ text: SYSTEM_PROMPT }]
              },
              contents: [
                {
                  role: "user",
                  parts: [{ text: prompt }]
                }
              ],
              generationConfig: {
                temperature: 0.2,
                responseMimeType: "application/json"
              }
            })
          })
        : await fetch(`${config.apiBaseUrl}/chat/completions`, {
            method: "POST",
            headers,
            signal: controller.signal,
            body: JSON.stringify({
              model: config.model,
              temperature: 0.2,
              response_format: {
                type: "json_object"
              },
              messages: [
                {
                  role: "system",
                  content: SYSTEM_PROMPT
                },
                {
                  role: "user",
                  content: prompt
                }
              ]
            })
          });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `Translation provider timed out after ${Math.floor(TRANSLATION_TIMEOUT_MS / 1000)}s.`
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Translation request failed: ${response.status} ${body}`);
  }

  const content =
    config.translationProvider === "gemini"
      ? extractGeminiText((await response.json()) as GeminiGenerateContentResponse)
      : ((await response.json()) as ChatCompletionResponse).choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Translation provider returned an empty message content.");
  }

  return content;
}

function buildGeminiRequestUrl(): string {
  const baseUrl = config.apiBaseUrl.replace(/\/$/, "");
  const versionedBase = /\/v\d+(beta)?$/i.test(baseUrl) ? baseUrl : `${baseUrl}/v1beta`;
  const modelName = config.model.replace(/^models\//, "");
  return `${versionedBase}/models/${encodeURIComponent(modelName)}:generateContent`;
}

function extractGeminiText(body: GeminiGenerateContentResponse): string | undefined {
  return body.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();
}
