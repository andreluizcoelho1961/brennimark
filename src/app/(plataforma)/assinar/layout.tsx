import { IdiomaDaSessao } from "@/components/IdiomaDaSessao";

/** O idioma da pessoa (cookie, perfil ou navegador) para a tela de assinar e a volta do pagamento. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <IdiomaDaSessao>{children}</IdiomaDaSessao>;
}
