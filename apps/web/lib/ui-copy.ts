export function getPageStatusLabel(status: string): string {
  switch (status) {
    case "draft":
      return "草稿";
    case "parsed":
      return "已解析";
    case "translated":
      return "已翻译";
    case "exported":
      return "已导出";
    default:
      return status;
  }
}

export function getRunStateLabel(state: string): string {
  switch (state) {
    case "done":
      return "已完成";
    case "running":
      return "进行中";
    case "queued":
      return "排队中";
    default:
      return state;
  }
}

