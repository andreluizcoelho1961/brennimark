"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useIsEnglish } from "@/platform/locale-client";

export function SignOutButton() {
  const router = useRouter();
  // Sair da conta é instrumento da plataforma: fala a língua da interface, e
  // estava fixo em inglês dentro de um produto que responde em português.
  const isEnglish = useIsEnglish();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="flex h-11 items-center rounded-[var(--radius-control)] px-2 text-[11px] font-medium tracking-wide text-platform-text-muted transition-colors duration-[var(--motion-control)] hover:text-platform-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-platform-focus sm:h-8"
    >
      {isEnglish ? "Sign out" : "Sair"}
    </button>
  );
}
