import { ImageResponse } from "next/og";
import { logoSvg } from "@/components/site/logo-svg";
import { PREVIA } from "@/components/site/metadados";

/**
 * A imagem que aparece quando alguém cola o link do site no WhatsApp, no
 * LinkedIn ou num e-mail — `/previa-do-site.png`, a mesma para todas as
 * páginas (ver `metadados.ts`).
 *
 * Gerada uma vez, no build (`force-static`), e servida pronta. O endereço é
 * FIXO de propósito: a convenção `opengraph-image` do Next dá um sufixo que
 * muda a cada versão, e as páginas que declaram a própria prévia perdiam a
 * imagem herdada. A extensão `.png` também passa pelo `proxy` sem sessão, que
 * é o que o WhatsApp tem.
 *
 * Usa a fonte padrão do gerador: a Inter do site é servida em woff2, formato
 * que o gerador de imagem não lê, e buscar outra na rede tornaria o build
 * dependente de um terceiro.
 */
export const dynamic = "force-static";

const LOGO = `data:image/svg+xml;utf8,${encodeURIComponent(logoSvg("#f2f5f6"))}`;

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#001621",
          color: "#f2f5f6",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- o gerador de imagem só lê <img>, não <Image> */}
        <img src={LOGO} width={441} height={100} alt="" />
        <div style={{ display: "flex", flexDirection: "column", fontSize: 64, lineHeight: 1.08, letterSpacing: -2 }}>
          <span>Uma marca passa por muitas mãos.</span>
          <span style={{ color: "#ff4103" }}>A ideia tem que passar por todas.</span>
        </div>
        <span style={{ fontSize: 22, letterSpacing: 4, color: "#b0c3ca" }}>PLATAFORMA DE GESTÃO DE MARCA</span>
      </div>
    ),
    { width: PREVIA.largura, height: PREVIA.altura },
  );
}
