import { AppShell } from "../components/app-shell";
import { WorkflowWorkspace } from "../components/workflow-workspace";
import { getKeywordLocks, getPages, getProjects, getSystemStatus } from "../lib/api-client";

type DashboardSearchParams = {
  step?: string | string[];
  pageId?: string | string[];
};

type DashboardWorkflowStep = "import" | "translate" | "edit" | "export";

const workflowSteps = new Set<DashboardWorkflowStep>(["import", "translate", "edit", "export"]);

function readSingleValue(value?: string | string[]): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DashboardPage(props: {
  searchParams?: Promise<DashboardSearchParams>;
}) {
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const [pages, projects, locks, systemStatus] = await Promise.all([
    getPages(),
    getProjects(),
    getKeywordLocks(),
    getSystemStatus()
  ]);
  const requestedStep = readSingleValue(searchParams?.step);
  const initialStep =
    requestedStep && workflowSteps.has(requestedStep as DashboardWorkflowStep)
      ? (requestedStep as DashboardWorkflowStep)
      : undefined;
  const initialPageId = readSingleValue(searchParams?.pageId);

  return (
    <AppShell
      active="dashboard"
      title="翻译工作台"
      description="在一个页面里完成接入代码、检查抽取、生成翻译、人工校对和回写代码，不再在侧边栏里来回切换。"
    >
      <WorkflowWorkspace
        projects={projects}
        pages={pages}
        locks={locks}
        systemStatus={systemStatus}
        initialStep={initialStep}
        initialPageId={initialPageId}
      />
    </AppShell>
  );
}
