import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { isOwnerEmail } from "@/lib/owner";
import AdminBoard from "./AdminBoard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Редакционен център | BAZARSPORT" };

export default async function AdminPage() {
  const user = await requireChatGPTUser("/admin");
  if (!isOwnerEmail(user.email)) {
    return <main className="min-h-screen bg-[#080b0d] p-8 text-white"><h1>Нямаш достъп до редакционния център.</h1><a href="/index.html">Върни се към сайта</a></main>;
  }
  return <AdminBoard owner={user.displayName} />;
}
