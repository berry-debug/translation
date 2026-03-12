import { redirect } from "next/navigation";

export default function ExportsPage() {
  redirect("/?step=export");
}
