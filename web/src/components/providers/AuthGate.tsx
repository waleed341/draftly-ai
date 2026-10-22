"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { apiFetch, setCsrfToken } from "@/lib/http";

type User = { id: number; email: string; role: string; status: string };
type SessionResponse = { user: User; csrf_token: string };
type SignupStep = "details" | "verify" | "password";

export function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [signupStep, setSignupStep] = useState<SignupStep>("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [registrationToken, setRegistrationToken] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiFetch("/api/auth/me").then(async (r) => {
      const session = (await r.json()) as SessionResponse;
      setCsrfToken(session.csrf_token);
      setUser(session.user);
    }).catch(() => undefined).finally(() => setLoading(false));
  }, []);

  function switchMode(next: "signin" | "signup") {
    setMode(next);
    setSignupStep("details");
    setPassword("");
    setConfirmPassword("");
    setCode("");
    setRegistrationToken("");
    setMessage("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if (mode === "signin") {
        const response = await apiFetch("/api/auth/login", {
          method: "POST", body: JSON.stringify({ email, password }),
        });
        const session = (await response.json()) as SessionResponse;
        setCsrfToken(session.csrf_token);
        setUser(session.user);
      } else if (signupStep === "details") {
        await apiFetch("/api/auth/register/request-code", {
          method: "POST", body: JSON.stringify({ name, email }),
        });
        setSignupStep("verify");
        setMessage(`If ${email} can be registered, a verification code has been sent.`);
      } else if (signupStep === "verify") {
        const response = await apiFetch("/api/auth/register/verify-code", {
          method: "POST", body: JSON.stringify({ email, code }),
        });
        const result = (await response.json()) as { registration_token: string };
        setRegistrationToken(result.registration_token);
        setSignupStep("password");
        setMessage("Email verified. Set a password to finish creating your account.");
      } else {
        if (password !== confirmPassword) {
          setMessage("Those passwords don't match.");
          return;
        }
        await apiFetch("/api/auth/register/complete", {
          method: "POST", body: JSON.stringify({ registration_token: registrationToken, password }),
        });
        switchMode("signin");
        setMessage("Account created. Sign in with your email and password.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not complete the request.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setCsrfToken(null);
    setUser(null);
  }

  if (loading) return <main className="grid min-h-screen place-items-center text-muted">Loading Draftly…</main>;
  if (!user) {
    const title = mode === "signin" ? "Sign in to Draftly" : "Create your Draftly account";
    const submitLabel = mode === "signin" ? "Sign in" : signupStep === "details" ? "Send verification code" : signupStep === "verify" ? "Verify email" : "Create account";
    return <main className="grid min-h-screen place-items-center bg-bg px-4 py-8 text-fg">
      <form onSubmit={submit} className="w-full max-w-xl space-y-5 rounded-2xl border border-line bg-surface p-7 sm:p-10">
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="mt-2 text-muted">
            {mode === "signin" ? "Sign in with your email and password. New accounts need email verification." : "Verify your email before setting a password and creating your account."}
          </p>
        </div>

        {mode === "signin" && <>
          <label className="block">Email<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-bg px-4 py-3" /></label>
          <label className="block">Password<input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-bg px-4 py-3" /></label>
        </>}

        {mode === "signup" && signupStep === "details" && <>
          <label className="block">Your name<input type="text" autoComplete="name" maxLength={100} required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-bg px-4 py-3" /></label>
          <label className="block">Email<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-bg px-4 py-3" /></label>
        </>}

        {mode === "signup" && signupStep === "verify" && <>
          <p className="text-sm text-muted">Enter the six-digit code sent to <strong className="text-fg">{email}</strong>.</p>
          <label className="block">Verification code<input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} className="mt-1 w-full rounded-lg border border-line bg-bg px-4 py-3 tracking-[0.3em]" /></label>
          <button type="button" onClick={() => { setSignupStep("details"); setCode(""); setMessage(""); }} className="text-sm text-accent-text">Change name or email</button>
        </>}

        {mode === "signup" && signupStep === "password" && <>
          <label className="block">Password (12 characters or more)<input type="password" autoComplete="new-password" minLength={12} maxLength={256} required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-bg px-4 py-3" /></label>
          <label className="block">Confirm password<input type="password" autoComplete="new-password" minLength={12} maxLength={256} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-bg px-4 py-3" /></label>
        </>}

        {message && <p role="status" className="text-sm text-accent-text">{message}</p>}
        <button disabled={busy} className="w-full rounded-lg bg-accent px-4 py-3 font-semibold text-white disabled:opacity-60">{busy ? "Please wait…" : submitLabel}</button>
        {mode === "signin" ? <div className="flex flex-wrap items-center justify-center gap-x-2 text-sm text-muted"><span>Don&apos;t have an account?</span><button type="button" onClick={() => switchMode("signup")} className="font-semibold text-accent-text hover:underline">Create account</button></div> : <button type="button" onClick={() => switchMode("signin")} className="w-full text-sm text-muted hover:text-fg">Already have an account? Sign in</button>}
      </form>
    </main>;
  }
  return <><nav aria-label="Account navigation" className="border-b border-line bg-bg px-4 py-2 text-xs text-muted"><div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-end gap-x-4 gap-y-2"><a href="/dashboard">Overview</a><a href="/dashboard/integrations">Integrations</a><a href="/dashboard/gmail-drafts">Gmail drafts</a><a href="/dashboard/scheduled">Scheduled</a><a href="/dashboard/sent">Sent</a><a href="/dashboard/failed">Failed</a>{user.role === "super_admin" && <a href="/dashboard/admin">Admin</a>}<span className="hidden sm:inline">{user.email}</span><button onClick={() => void logout()} className="text-accent-text">Sign out</button></div></nav>{children}</>;
}
