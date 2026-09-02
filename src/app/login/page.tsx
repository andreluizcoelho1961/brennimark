"use client";

import { platformIdentity } from "@/platform/identity";
import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useIsEnglish } from "@/platform/locale-client";
import { destinoDeRetorno } from "@/platform/destino-de-retorno";

type Mode = "signin" | "signup";
type Status = "idle" | "submitting" | "check-email" | "error";

const AUTH_FAILED_MESSAGE_POR_IDIOMA = {
  en: "Something went wrong signing in. Please try again.",
  "pt-BR": "Algo deu errado ao entrar. Tente de novo.",
};

function LoginForm() {
  const isEnglish = useIsEnglish();
  const AUTH_FAILED_MESSAGE = AUTH_FAILED_MESSAGE_POR_IDIOMA[isEnglish ? "en" : "pt-BR"];
  const router = useRouter();
  const searchParams = useSearchParams();
  const hadAuthError = searchParams.get("error") === "auth_failed";
  const next = destinoDeRetorno(searchParams.get("next"));

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>(hadAuthError ? "error" : "idle");
  const [errorMessage, setErrorMessage] = useState(hadAuthError ? AUTH_FAILED_MESSAGE : "");

  function switchMode(next: Mode) {
    setMode(next);
    setStatus("idle");
    setErrorMessage("");
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage("");

    const supabase = createClient();
    // Defensive normalization — mobile keyboards/autofill can slip in a
    // leading capital letter or stray whitespace even with
    // autoCapitalize="none" on the input.
    const normalizedEmail = email.trim().toLowerCase();

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (error) {
        setStatus("error");
        setErrorMessage(error.message);
        return;
      }
      router.push(next);
      router.refresh();
      return;
    }

    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: { emailRedirectTo: redirectTo },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    if (data.session) {
      // Email confirmation is disabled on this project — signed in immediately.
      router.push(`/onboarding?next=${encodeURIComponent(next)}`);
      router.refresh();
      return;
    }

    // Email confirmation is enabled — a confirmation link was sent.
    setStatus("check-email");
  }

  return (
    <div className="w-full max-w-sm">
      <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-release-analog-turquoise">
        {platformIdentity.displayName}
      </p>
      <h1 className="mt-3 font-display text-3xl font-black uppercase leading-[0.95] text-release-analog-white">
        {mode === "signin"
          ? isEnglish
            ? "Sign in to access the brand guide"
            : "Entre para acessar o guia da marca"
          : isEnglish
            ? "Create your account"
            : "Crie sua conta"}
      </h1>

      <div className="mt-6 flex gap-6 border-b border-border-default">
        <button
          type="button"
          onClick={() => switchMode("signin")}
          className={`pb-3 font-display text-xs font-bold uppercase tracking-wide transition-colors duration-150 ${
            mode === "signin"
              ? "border-b-2 border-release-analog-turquoise text-release-analog-white"
              : "text-text-secondary hover:text-release-analog-white"
          }`}
        >
          {isEnglish ? "Sign in" : "Entrar"}
        </button>
        <button
          type="button"
          onClick={() => switchMode("signup")}
          className={`pb-3 font-display text-xs font-bold uppercase tracking-wide transition-colors duration-150 ${
            mode === "signup"
              ? "border-b-2 border-release-analog-turquoise text-release-analog-white"
              : "text-text-secondary hover:text-release-analog-white"
          }`}
        >
          {isEnglish ? "Create account" : "Criar conta"}
        </button>
      </div>

      {status === "check-email" ? (
        <p role="status" className="mt-8 border border-border-default px-4 py-3 text-sm text-release-analog-white">
          {isEnglish
            ? <>Confirm your email at <strong>{email}</strong> to activate your account, then come back here and sign in.</>
            : <>Confirme seu e-mail em <strong>{email}</strong> pra ativar a conta, depois volte aqui e entre.</>}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="sr-only">
              {isEnglish ? "Email" : "E-mail"}
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full border border-border-default bg-transparent px-4 py-3 text-sm text-release-analog-white placeholder:text-text-secondary focus:border-release-analog-white"
            />
          </div>

          <div>
            <label htmlFor="password" className="sr-only">
              {isEnglish ? "Password" : "Senha"}
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isEnglish ? "Password" : "Senha"}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              aria-describedby={status === "error" ? "login-error" : undefined}
              className="w-full border border-border-default bg-transparent px-4 py-3 text-sm text-release-analog-white placeholder:text-text-secondary focus:border-release-analog-white"
            />
          </div>

          <button
            type="submit"
            disabled={status === "submitting"}
            className="border border-release-analog-white px-6 py-3 font-display text-xs font-bold uppercase tracking-wide text-release-analog-white transition-colors duration-150 hover:bg-release-analog-white hover:text-release-analog-black disabled:opacity-50"
          >
            {status === "submitting" ? "…" : mode === "signin" ? (isEnglish ? "Sign in" : "Entrar") : (isEnglish ? "Create account" : "Criar conta")}
          </button>

          {status === "error" && (
            <p id="login-error" role="alert" className="text-xs text-release-analog-blue">
              {errorMessage ||
                (isEnglish ? "Something went wrong. Try again." : "Algo deu errado. Tente de novo.")}
            </p>
          )}
        </form>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-page-inline py-24">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
