"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { authenticate, createWorkspace, requestRecovery, resetPassword } from "@/app/actions";
import { Icon } from "./icon";

export function AuthForm({ mode }: { mode: "login" | "signup" | "onboarding" | "recovery" | "reset" }) {
  const [message, setMessage] = useState<{ error?: string; success?: string }>({});
  const [pending, startTransition] = useTransition();
  const title = { login: "Welcome back.", signup: "Your stock, in focus.", onboarding: "Make it your workspace.", recovery: "Reset your password.", reset: "Choose a new password." }[mode];
  async function submit(form: FormData) {
    setMessage({});
    startTransition(async () => {
      try {
        const result = mode === "onboarding" ? await createWorkspace(form) : mode === "recovery" ? await requestRecovery(form) : mode === "reset" ? await resetPassword(form) : await authenticate(form);
        setMessage(result);
      } catch (error) {
        if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) throw error;
        setMessage({ error: "The request could not be completed. Please retry." });
      }
    });
  }
  return <div className="auth-wrap">
    <Link href="/" className="brand"><span className="brand-mark"><Icon name="boxes" /></span>stockroom<span className="brand-dot">.</span></Link>
    <div className="auth-card">
      <span className="eyebrow">INVENTORY INTELLIGENCE</span><h1>{title}</h1>
      <p>{mode === "onboarding" ? "Start with an empty workspace. Your business data is private to your account." : "A clearer view of your inventory starts here."}</p>
      <form action={submit} className="form-stack">
        <input type="hidden" name="mode" value={mode} />
        {mode === "onboarding" ? <>
          <label>Business name<input name="name" required minLength={2} maxLength={100} placeholder="Harbour & Field" /></label>
          <label>Reporting currency<select name="currency" defaultValue="NZD"><option>NZD</option><option>AUD</option><option>USD</option><option>GBP</option><option>EUR</option></select></label>
        </> : <>
          {mode !== "reset" && <label>Email address<input name="email" type="email" autoComplete="email" required placeholder="you@business.com" /></label>}
          {mode !== "recovery" && <label>Password<input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={12} maxLength={128} required placeholder="At least 12 characters" /></label>}
        </>}
        {message.error && <p className="form-error" role="alert">{message.error}</p>}
        {message.success && <p className="form-success" role="status">{message.success}</p>}
        <button className="button primary" disabled={pending}>{pending ? "Working…" : { login: "Sign in", signup: "Create account", onboarding: "Create workspace", recovery: "Send recovery email", reset: "Update password" }[mode]}<Icon name="arrow" size={18} /></button>
      </form>
      {mode === "login" && <div className="auth-links"><Link href="/signup">Create an account</Link><Link href="/forgot-password">Forgot password?</Link></div>}
      {mode === "signup" && <p className="auth-foot">Already have an account? <Link href="/login">Sign in</Link></p>}
      <Link className="demo-link" href="/demo">Explore the interactive demo <Icon name="arrow" size={15} /></Link>
    </div>
    <p className="auth-caption"><Icon name="shield" size={14} /> Organization access is enforced at the database.</p>
  </div>;
}
