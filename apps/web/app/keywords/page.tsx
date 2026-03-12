import { AppShell } from "../../components/app-shell";
import { KeywordWorkspace } from "../../components/keyword-workspace";
import { ProjectWorkspace } from "../../components/project-workspace";
import { getKeywordLocks, getProjects } from "../../lib/api-client";

export default async function KeywordsPage() {
  const [projects, keywordLocks] = await Promise.all([getProjects(), getKeywordLocks()]);

  return (
    <AppShell
      active="keywords"
      title="规则"
      description="这里放低频但重要的辅助配置，包括站点信息和 SEO 锁词规则。日常翻译流程还是优先在工作台里完成。"
    >
      <div className="space-y-6">
        <ProjectWorkspace projects={projects} />
        <KeywordWorkspace projects={projects} locks={keywordLocks} />
      </div>
    </AppShell>
  );
}
