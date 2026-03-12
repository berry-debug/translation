import { redirect } from "next/navigation";

export default async function ReviewPage(props: {
  searchParams?: Promise<{ pageId?: string | string[] }>;
}) {
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const pageId = Array.isArray(searchParams?.pageId) ? searchParams?.pageId[0] : searchParams?.pageId;
  redirect(pageId ? `/?step=edit&pageId=${encodeURIComponent(pageId)}` : "/?step=edit");
}
