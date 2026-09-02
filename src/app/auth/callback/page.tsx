"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { destinoDeRetorno } from "@/platform/destino-de-retorno";

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const supabase = createClient();
      const next = destinoDeRetorno(searchParams.get("next"));

      // Implicit flow delivers the session via the URL hash fragment —
      // getSession() awaits the client's initial hash-parsing pass
      // before returning, so this is enough to pick it up.
      const { data, error } = await supabase.auth.getSession();

      if (cancelled) return;

      if (error || !data.session) {
        router.replace("/login?error=auth_failed");
        return;
      }

      // Drop the tokens from the visible URL now that the session is stored.
      window.history.replaceState(null, "", window.location.pathname);

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
