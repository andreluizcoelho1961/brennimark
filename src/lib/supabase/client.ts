import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // @supabase/ssr defaults to "pkce", which requires the browser
      // that opened the magic link to have the code_verifier cookie
      // set by the browser that requested it — breaks when the OS/mail
      // client opens the link in a different browser (e.g. requested
      // in Chrome, opened in Safari). "implicit" puts the session
      // tokens directly in the redirect URL instead, so it works
      // regardless of which browser opens the link.
      auth: { flowType: "implicit" },
    },
  );
}
