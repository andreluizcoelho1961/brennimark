"use client";

import { platformIdentity } from "@/platform/identity";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useIsEnglish } from "@/platform/locale-client";
import { destinoDeRetorno } from "@/platform/destino-de-retorno";

function OnboardingForm() {
  const isEnglish = useIsEnglish();
  const t = (pt: string, en: string) => (isEnglish ? en : pt);
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = destinoDeRetorno(searchParams.get("next"));

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setEmail(data.user.email ?? null);
    });
  }, [router]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage("");

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.replace("/login");
      return;
    }

    const { error } = await supabase.from("profiles").upsert({
      id: userData.user.id,
      email: userData.user.email,
      full_name: fullName,
      company: company || null,
    });

    if (error) {
      setSubmitting(false);
      setErrorMessage(error.message);
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
    <div className="w-full max-w-sm">
      <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-release-analog-turquoise">
        {t("Falta um passo", "One more step")}
      </p>
      <h1 className="mt-3 font-display text-3xl font-black uppercase leading-[0.95] text-release-analog-white">
        {t("Diga quem você é", "Tell us who you are")}
      </h1>
      {email && (
        <p className="mt-4 text-sm text-text-secondary">
          {t("Entrou como", "Signed in as")} <strong className="text-release-analog-white">{email}</strong>
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <div>
          <label htmlFor="fullName" className="mb-1.5 block font-display text-xs font-bold uppercase tracking-wide text-text-secondary">
            {t("Nome", "Name")}
          </label>
          <input
            id="fullName"
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            className="w-full border border-border-default bg-transparent px-4 py-3 text-sm text-release-analog-white focus:border-release-analog-white"
          />
        </div>

        <div>
          <label htmlFor="company" className="mb-1.5 block font-display text-xs font-bold uppercase tracking-wide text-text-secondary">
            {t("Empresa / estúdio", "Company / studio")} <span className="normal-case text-text-secondary">({t("opcional", "optional")})</span>
          </label>
          <input
            id="company"
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            autoComplete="organization"
            className="w-full border border-border-default bg-transparent px-4 py-3 text-sm text-release-analog-white focus:border-release-analog-white"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || !email}
          className="mt-2 border border-release-analog-white px-6 py-3 font-display text-xs font-bold uppercase tracking-wide text-release-analog-white transition-colors duration-150 hover:bg-release-analog-white hover:text-release-analog-black disabled:opacity-50"
        >
          {submitting ? t("Salvando…", "Saving…") : t(`Entrar no ${platformIdentity.displayName}`, `Enter ${platformIdentity.displayName}`)}
        </button>

        {errorMessage && (
          <p role="alert" className="text-xs text-release-analog-blue">
            {errorMessage}
          </p>
        )}
      </form>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-page-inline py-24">
      <Suspense fallback={null}>
        <OnboardingForm />
      </Suspense>
    </main>
  );
}
