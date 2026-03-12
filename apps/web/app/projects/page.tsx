import { AppShell } from "../../components/app-shell";
import { ProjectWorkspace } from "../../components/project-workspace";
import { getProjects } from "../../lib/api-client";

export default async function ProjectsPage() {
  const projects = await getProjects();

  return (
    <AppShell
      active="projects"
      title="站点配置"
      description="这里是低频维护页，用来确认 KusaPics 的基础域名和目标语言。它不是主流程入口，日常使用时通常不需要频繁进入。"
    >
      <ProjectWorkspace projects={projects} />
    </AppShell>
  );
}
