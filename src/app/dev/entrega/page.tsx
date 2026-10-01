import { notFound } from "next/navigation";
import { LocaleProvider } from "@/platform/locale-client";
import { EntregaPublica, LinkIndisponivel } from "@/components/entrega/EntregaPublica";
import type { VistaDaEntrega } from "@/lib/links/vista";

export const metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" as const };

const CODIGO = "c".repeat(43);

const VISTA: VistaDaEntrega = {
  marca: "Marca Um",
  nome: "Gráfica Pampa — cartazes de outubro",
  destinatario: "Carla",
  expira_em: "2026-10-07T15:00:00Z",
  itens: [
    {
      id: "i1", nome: "Logotipo", tipo: "logo",
      regra: [
        { pagina: 9, titulo: "Área de proteção", status: "ready", imagem: null },
        { pagina: 11, titulo: "Redução mínima", status: "draft", imagem: null },
      ],
      arquivos: [
        { id: "a1", label: "Logo principal", file_name: "logo-principal.svg", mime_type: "image/svg+xml", size_bytes: 24_000, miniatura: null, atualizado_em: "2026-10-01T13:00:00Z", retirado: false },
        { id: "a2", label: "Logo negativo", file_name: "logo-negativo.svg", mime_type: "image/svg+xml", size_bytes: 22_000, miniatura: null, atualizado_em: null, retirado: false },
      ],
    },
    {
      id: "i2", nome: "Ícones", tipo: "icone", regra: [],
      arquivos: [
        { id: "a3", label: "Casa", file_name: "casa.svg", mime_type: "image/svg+xml", size_bytes: 1_000, miniatura: null, atualizado_em: null, retirado: true },
      ],
    },
  ],
};

/**
 * A bancada da página PÚBLICA do link. A de verdade abre o link no banco com a
 * chave de serviço; aqui a vista vem pronta, e o teste de navegador finge
 * `/api/entrega/.../baixar`. `?estado=` mostra as páginas de link indisponível.
 */
export default async function BancadaDaEntrega({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { estado } = await searchParams;
  const indisponivel = estado === "expirado" || estado === "revogado" || estado === "inexistente" || estado === "erro" ? estado : null;
  return (
    <LocaleProvider locale="pt-BR">
      {indisponivel ? <LinkIndisponivel estado={indisponivel} /> : <EntregaPublica codigo={CODIGO} vista={VISTA} />}
    </LocaleProvider>
  );
}
