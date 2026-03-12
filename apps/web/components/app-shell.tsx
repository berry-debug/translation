import Link from "next/link";
import type { ReactNode } from "react";

type NavKey = "dashboard" | "projects" | "keywords" | "settings";

const navItems: Array<{ key: NavKey; href: string; label: string }> = [
  { key: "dashboard", href: "/", label: "工作台" },
  { key: "projects", href: "/projects", label: "站点" },
  { key: "keywords", href: "/keywords", label: "规则" },
  { key: "settings", href: "/settings", label: "设置" }
];

interface AppShellProps {
  active: NavKey;
  title: string;
  description: string;
  children: ReactNode;
}

export function AppShell({ active, title, description, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="mx-auto grid min-h-screen max-w-[1720px] gap-4 px-4 py-4 lg:grid-cols-[264px_minmax(0,1fr)] lg:px-6 lg:py-6">
        <aside className="ui-panel border-b border-ink/10 px-4 py-5 lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:overflow-auto lg:border-b lg:border-r-0">
          <div className="rounded-[1.15rem] border border-white/40 bg-ink px-4 py-3.5 text-paper shadow-panel">
            <div className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
              <p className="ui-kicker text-paper/70">KusaPics Localization</p>
            </div>
            <h1 className="mt-3 max-w-[8ch] text-[1.45rem] leading-[0.98] text-paper">多语言本地化工作台</h1>
            <p className="mt-3 text-[13px] leading-6 text-paper/74">
              内部翻译工具。导入代码、生成草稿、人工校对，再回写到工作树。
            </p>
          </div>

          <nav className="mt-5 space-y-2">
            {navItems.map((item, index) => {
              const isActive = item.key === active;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`flex items-center justify-between rounded-2xl border px-4 py-2.5 text-sm transition ${
                    isActive
                      ? "border-ink bg-ink text-paper shadow-panel"
                      : "border-ink/10 bg-white/48 text-ink/60 hover:border-ink/20 hover:bg-white/70 hover:text-ink"
                  }`}
                >
                  <span>{item.label}</span>
                  <span className={`ui-kicker ${isActive ? "text-paper/55" : "text-ink/34"}`}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="ui-panel-muted mt-5 p-4 text-sm leading-6 text-ink/58">
            <p className="ui-kicker">Operator Notes</p>
            <p className="mt-3">主流程集中在工作台中线性完成，低频配置折叠到规则与设置页。</p>
            <p className="mt-2">强调上下文和操作状态，减少无效装饰。</p>
          </div>
        </aside>

        <main className="ui-panel min-w-0 px-5 py-5 lg:px-7 lg:py-6 xl:px-8">
          <header className="grid items-start gap-4 border-b border-ink/10 pb-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0">
              <p className="ui-kicker">Workspace</p>
              <h2 className="mt-2 max-w-[10ch] text-[2.15rem] leading-[0.94] text-ink lg:text-[2.85rem]">{title}</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-ink/62 xl:hidden">{description}</p>
            </div>
            <div className="ui-panel-muted hidden p-4 xl:block">
              <p className="ui-kicker">Context</p>
              <p className="mt-2 max-w-md text-sm leading-6 text-ink/62">{description}</p>
            </div>
          </header>

          <section className="pt-6">{children}</section>
        </main>
      </div>
    </div>
  );
}
