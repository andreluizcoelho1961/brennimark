import { IdiomaDaSessao } from "@/components/IdiomaDaSessao";

/** O idioma de quem abriu o link do e-mail (cookie, perfil ou navegador). */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <IdiomaDaSessao>{children}</IdiomaDaSessao>;
}
