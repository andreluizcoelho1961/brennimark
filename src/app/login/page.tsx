"use client";

import { platformIdentity } from "@/platform/identity";
import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useIsEnglish } from "@/platform/locale-client";
import { destinoDeRetorno } from "@/platform/destino-de-retorno";

/*
 * Conta de TIME, fechada — decisão do André, 17/09/2026.
 *
 * Esta tela só ENTRA. Não existe cadastro público: quem assina recebe a conta, e
 * o administrador libera as outras pessoas. Antes de hoje havia uma aba "Criar
 * conta" que chamava `signUp`, e o gatilho `handle_new_profile` criava uma conta
 * NOVA com a pessoa como dona — qualquer visitante virava administrador de uma
 * conta própria dentro do produto.
 *
 * ⚠️ Tirar a aba NÃO fecha o portão. O endereço de cadastro do Supabase continua
 * respondendo a quem chamar direto, e quem fecha de verdade é a configuração do
 * projeto ("Allow new users to sign up", desligada no painel). Esta tela deixa
 * de oferecer o caminho; a configuração é o que o impede.
 */
type Status = "idle" | "submitting" | "error";

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

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>(hadAuthError ? "error" : "idle");
  const [errorMessage, setErrorMessage] = useState(hadAuthError ? AUTH_FAILED_MESSAGE : "");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage("");

    const supabase = createClient();
    // Defensive normalization — mobile keyboards/autofill can slip in a
    // leading capital letter or stray whitespace even with
    // autoCapitalize="none" on the input.
    const normalizedEmail = email.trim().toLowerCase();

    const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <div className="w-full max-w-sm">
      <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-platform-text">
        {platformIdentity.displayName}
      </p>
      <h1 className="mt-3 font-display text-3xl font-black uppercase leading-[0.95] text-platform-text">
        {isEnglish ? "Sign in to access the brand guide" : "Entre para acessar o guia da marca"}
      </h1>

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
              className="w-full border border-platform-border bg-transparent px-4 py-3 text-sm text-platform-text placeholder:text-platform-text-muted focus:border-platform-signal"
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
              autoComplete="current-password"
              aria-describedby={status === "error" ? "login-error" : undefined}
              className="w-full border border-platform-border bg-transparent px-4 py-3 text-sm text-platform-text placeholder:text-platform-text-muted focus:border-platform-signal"
            />
          </div>

          <button
            type="submit"
            disabled={status === "submitting"}
            className="border border-platform-signal px-6 py-3 font-display text-xs font-bold uppercase tracking-wide text-platform-text transition-colors duration-150 hover:bg-platform-text hover:text-platform-bg disabled:opacity-50"
          >
            {status === "submitting" ? "…" : isEnglish ? "Sign in" : "Entrar"}
          </button>

          {status === "error" && (
            <p id="login-error" role="alert" className="text-xs text-platform-text-muted">
              {errorMessage ||
                (isEnglish ? "Something went wrong. Try again." : "Algo deu errado. Tente de novo.")}
            </p>
          )}
        </form>

        {/* Quem chegou aqui sem conta precisa saber a quem pedir — e que o
            caminho é uma pessoa, não um formulário. */}
        <p className="mt-8 border-t border-platform-border pt-6 text-xs leading-relaxed text-platform-text-muted">
          {isEnglish
            ? "Access is granted by your team's administrator. There is no public sign-up."
            : "O acesso é liberado pelo administrador da sua equipe. Não há cadastro público."}
        </p>
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
