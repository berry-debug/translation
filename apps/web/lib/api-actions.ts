"use client";

import { API_BASE_URL } from "./api-base";

interface JsonError {
  message?: string;
}

const DEFAULT_REQUEST_TIMEOUT_MS = 300_000;
const DEFAULT_EXPORT_FORMATS = ["json"] as const;

async function requestJson<T>(path: string, init: RequestInit, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS): Promise<T> {
  const hasBody = typeof init.body !== "undefined";
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        ...(hasBody ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {})
      }
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`请求超时，${Math.floor(timeoutMs / 1000)} 秒内未收到响应。`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;

    try {
      const body = (await response.json()) as JsonError;
      if (body.message) {
        message = body.message;
      }
    } catch {
      // Ignore JSON parse errors and fall back to the HTTP status.
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const responseText = await response.text();
  if (!responseText.trim()) {
    return undefined as T;
  }

  return JSON.parse(responseText) as T;
}

export async function createProject(input: {
  name: string;
  baseUrl: string;
  targetLanguages: string[];
}) {
  return requestJson("/api/projects", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      baseUrl: input.baseUrl,
      sourceLanguage: "en",
      targetLanguages: input.targetLanguages
    })
  });
}

export async function createPage(input: {
  projectId: string;
  content: string;
}) {
  return requestJson("/api/pages", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function importFiles(input: {
  projectId: string;
  files: Array<{
    name: string;
    relativePath?: string;
    content: string;
  }>;
}) {
  return requestJson("/api/import/files", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function importFolder(input: {
  projectId: string;
  folderPath: string;
}) {
  return requestJson("/api/import/folder", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function importGitRepository(input: {
  projectId: string;
  repoUrl: string;
  branch?: string;
}) {
  return requestJson("/api/import/git", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function translatePageAll(pageId: string) {
  return requestJson(`/api/translate/page/${pageId}/all`, {
    method: "POST"
  }, DEFAULT_REQUEST_TIMEOUT_MS);
}

export async function translatePage(input: { pageId: string; targetLanguage: string }) {
  return requestJson("/api/translate/page", {
    method: "POST",
    body: JSON.stringify(input)
  }, DEFAULT_REQUEST_TIMEOUT_MS);
}

export async function createKeywordLock(input: {
  projectId: string;
  sourceKeyword: string;
  targetLanguage: string;
  targetKeyword: string;
}) {
  return requestJson("/api/keywords", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function runProject(projectId: string, languages?: string[]) {
  return requestJson(`/api/run/project/${projectId}`, {
    method: "POST",
    body: JSON.stringify({
      formats: DEFAULT_EXPORT_FORMATS,
      languages
    })
  }, DEFAULT_REQUEST_TIMEOUT_MS);
}

export async function saveTranslation(input: {
  pageId: string;
  language: string;
  schema?: object;
  document?: unknown;
}) {
  return requestJson(`/api/pages/${input.pageId}/translations/${input.language}`, {
    method: "PUT",
    body: JSON.stringify({
      schema: input.schema,
      document: input.document
    })
  });
}

export async function deletePage(pageId: string) {
  return requestJson(`/api/pages/${pageId}`, {
    method: "DELETE"
  });
}

export async function clearProjectPages(projectId: string) {
  return requestJson(`/api/projects/${projectId}/pages`, {
    method: "DELETE"
  });
}

export async function saveProjectExports(input: {
  projectId: string;
  targetPath?: string;
}) {
  return requestJson(`/api/exports/${input.projectId}/save`, {
    method: "POST",
    body: JSON.stringify({
      targetPath: input.targetPath,
      formats: DEFAULT_EXPORT_FORMATS
    })
  });
}

export async function updateSystemConfig(input: {
  translationProvider?: string;
  apiKey?: string;
  model?: string;
  apiBaseUrl?: string;
  clearApiKey?: boolean;
}) {
  return requestJson("/api/system/config", {
    method: "POST",
    body: JSON.stringify(input)
  });
}
