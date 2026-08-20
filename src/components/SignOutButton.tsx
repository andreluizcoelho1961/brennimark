"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();

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
      className="font-display text-[11px] font-bold uppercase tracking-wide text-text-secondary transition-colors duration-150 hover:text-release-analog-white"
    >
      Sign out
    </button>
  );
}
