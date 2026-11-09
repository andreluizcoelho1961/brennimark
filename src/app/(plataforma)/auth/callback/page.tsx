"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { destinoDeRetorno } from "@/platform/destino-de-retorno";
import { lerSessaoDoFragmento } from "@/lib/supabase/sessao-do-fragmento";

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      // Lido ANTES de criar o cliente: ele examina o endereço ao nascer.
      const fragmento = lerSessaoDoFragmento(window.location.hash);
      const supabase = createClient();
      const next = destinoDeRetorno(searchParams.get("next"));

      // Os links gerados pelo servidor (primeiro acesso no Console, "Esqueci a
      // senha") trazem a sessão no fragmento do endereço:
      // `#access_token=…&refresh_token=…`. O cliente do `@supabase/ssr` força
      // o fluxo PKCE e RECUSA esse formato ("Not a valid PKCE flow url"), em
      // silêncio — achado em 07/10/2026, no primeiro teste real do "Esqueci a
      // senha": o link caía em /login?error=auth_failed. Por isso a sessão do
      // fragmento é entregue aqui, à mão, ao `setSession`, que confere o token
      // no servidor de autenticação antes de aceitar.
      if (fragmento) {
        const { error: erroDoFragmento } = await supabase.auth.setSession(fragmento);
        if (cancelled) return;
        if (erroDoFragmento) {
          router.replace("/login?error=auth_failed");
          return;
        }
      }

      const { data, error } = await supabase.auth.getSession();

      if (cancelled) return;

      if (error || !data.session) {
        router.replace("/login?error=auth_failed");
        return;
      }

      // Tira do endereço SÓ os tokens (o fragmento), guardada a sessão, e só
      // quando há fragmento: o Next.js trata toda troca de endereço como
      // mudança de `searchParams`, e trocar sempre faria o efeito rodar de novo
      // sem fim. Até
      // 07/10/2026 esta linha tirava também a busca (`?next=…`): o endereço
      // mudava, o `useSearchParams` mudava, e o efeito rodava de novo sem fim —
      // a tela ficava em "Signing in…", consultando o perfil em laço, e o
      // destino se perdia. O defeito ficou escondido porque o fragmento nunca
      // abria sessão (ver acima).
      if (window.location.hash) window.history.replaceState(null, "", window.location.pathname + window.location.search);

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("id", data.session.user.id)
        .maybeSingle();

      if (cancelled) return;

      if (!profile || !profile.full_name) {
        router.replace(`/onboarding?next=${encodeURIComponent(next)}`);
      } else {
        router.replace(next);
      }
    }

    run().catch(() => {
      if (!cancelled) setFailed(true);
    });

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  useEffect(() => {
    if (failed) router.replace("/login?error=auth_failed");
  }, [failed, router]);

  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-page-inline py-24">
      <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-platform-text-muted">
        Signing in…
      </p>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <AuthCallbackInner />
    </Suspense>
  );
}
