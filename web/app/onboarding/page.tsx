import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { createClient } from "@/lib/supabase/server";
export const metadata = { title: "Set up workspace", robots: { index: false, follow: false } };
async function OnboardingContent() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <AuthForm mode="onboarding" />;
}
export default function Onboarding() { return <Suspense fallback={<div className="loading">Preparing your workspace…</div>}><OnboardingContent /></Suspense>; }
