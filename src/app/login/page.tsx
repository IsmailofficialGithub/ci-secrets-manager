"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

function getRedirectUrl() {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/auth/callback`;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackError = searchParams.get("error");

  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    callbackError === "auth_callback_failed"
      ? "Email confirmation failed. Try signing in or request a new link."
      : null,
  );
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setSuccess(null);
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const supabase = createBrowserSupabaseClient();
    const { data, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: getRedirectUrl(),
        data: {
          full_name: name.trim(),
          name: name.trim(),
        },
      },
    });

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    if (data.user?.identities?.length === 0) {
      setError("An account with this email already exists. Try signing in.");
      return;
    }

    if (!data.session) {
      setSuccess(
        `We sent a verification link to ${email.trim()}. Open it to activate your account, then sign in.`,
      );
      setPassword("");
      setMode("signin");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const supabase = createBrowserSupabaseClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (authError) {
      if (authError.message.toLowerCase().includes("invalid login credentials")) {
        setError(
          "Invalid email or password. If you just signed up, confirm your email first (check your inbox).",
        );
      } else {
        setError(authError.message);
      }
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function handleResendVerification() {
    if (!email.trim()) {
      setError("Enter your email address first.");
      return;
    }
    setError(null);
    setLoading(true);

    const supabase = createBrowserSupabaseClient();
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: getRedirectUrl() },
    });

    setLoading(false);

    if (resendError) {
      setError(resendError.message);
      return;
    }

    setSuccess(`Verification email sent to ${email.trim()}.`);
  }

  const inputClass =
    "mt-1.5 w-full rounded-lg border border-slate-600/80 bg-slate-900/80 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30";

  return (
    <main className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 text-lg font-bold text-white shadow-lg shadow-cyan-500/25">
            PS
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Pipeline Secrets
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Encrypted secrets for your CI/CD pipelines
          </p>
        </div>

        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-6 shadow-2xl shadow-black/40 backdrop-blur-sm sm:p-8">
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-slate-800/80 p-1">
            <button
              type="button"
              onClick={() => switchMode("signin")}
              className={`rounded-md py-2 text-sm font-medium transition ${
                mode === "signin"
                  ? "bg-slate-700 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => switchMode("signup")}
              className={`rounded-md py-2 text-sm font-medium transition ${
                mode === "signup"
                  ? "bg-slate-700 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Create account
            </button>
          </div>

          {success && (
            <div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              {success}
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {mode === "signup" ? (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div>
                <label htmlFor="name" className="text-sm font-medium text-slate-300">
                  Full name
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="Jane Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="signup-email" className="text-sm font-medium text-slate-300">
                  Email
                </label>
                <input
                  id="signup-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="signup-password" className="text-sm font-medium text-slate-300">
                  Password
                </label>
                <input
                  id="signup-password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:opacity-95 disabled:opacity-50"
              >
                {loading ? "Creating account…" : "Create account & send verification"}
              </button>
              <p className="text-center text-xs text-slate-500">
                We&apos;ll email you a link to verify your address before you can sign in.
              </p>
            </form>
          ) : (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label htmlFor="signin-email" className="text-sm font-medium text-slate-300">
                  Email
                </label>
                <input
                  id="signin-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="signin-password" className="text-sm font-medium text-slate-300">
                  Password
                </label>
                <input
                  id="signin-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:opacity-95 disabled:opacity-50"
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={loading}
                className="w-full text-center text-xs text-slate-400 underline-offset-2 hover:text-cyan-400 hover:underline disabled:opacity-50"
              >
                Resend verification email
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center text-slate-400">
          Loading…
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
