import type {
  DashboardOverview,
  KeywordLock,
  PageExportBundle,
  PageRecord,
  Project,
  SystemStatus
} from "@seo-localization/shared";
import { API_BASE_URL } from "./api-base";

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Request failed: ${response.status} ${body}`);
  }

  return (await response.json()) as T;
}

export async function getOverview(): Promise<DashboardOverview> {
  return fetchJson("/api/overview");
}

export async function getProjects(): Promise<Project[]> {
  return fetchJson("/api/projects");
}

export async function getPages(projectId?: string): Promise<PageRecord[]> {
  const path = projectId ? `/api/pages?projectId=${projectId}` : "/api/pages";
  return fetchJson(path);
}

export async function getKeywordLocks(projectId?: string): Promise<KeywordLock[]> {
  const path = projectId ? `/api/keywords?projectId=${projectId}` : "/api/keywords";
  return fetchJson(path);
}

export async function getExports(projectId: string): Promise<PageExportBundle[]> {
  return fetchJson(`/api/exports/${projectId}`);
}

export async function getSystemStatus(): Promise<SystemStatus> {
  return fetchJson("/api/system/status");
}
