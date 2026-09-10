import { redirect } from "next/navigation";
import { getSessionUser, safeInternalPath } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getSessionUser();
  const { next } = await searchParams;
  const nextPath = safeInternalPath(next) || "/";
  if (user) redirect(nextPath);
  return <LoginForm nextPath={nextPath} />;
}
