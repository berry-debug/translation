import { AppShell } from "../../components/app-shell";
import { SettingsWorkspace } from "../../components/settings-workspace";
import { getSystemStatus } from "../../lib/api-client";

export default async function SettingsPage() {
  const systemStatus = await getSystemStatus();

  return (
    <AppShell
      active="settings"
      title="设置"
      description="先把翻译模型、接口地址和 API Key 配好，工作台里的翻译步骤才能真正跑起来。"
    >
      <SettingsWorkspace systemStatus={systemStatus} />
    </AppShell>
  );
}
