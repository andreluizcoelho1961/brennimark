import Image, { type StaticImageData } from "next/image";

/**
 * Uma captura REAL da plataforma, numa página do site (23/10/2026).
 *
 * Pedido do André: no lugar dos estudos de tela desenhados em código, o produto
 * de verdade. As capturas são da marca Brennimark (manual v0.3) em produção,
 * tiradas com densidade 2 (2880 × 1800) para ficar nítidas, e sem dado pessoal:
 * e-mails e nomes de quem usa viram nomes fictícios, e o endereço de um link de
 * entrega vira um exemplo.
 */
export function Captura({ src, alt }: { src: StaticImageData; alt: string }) {
  return (
    <div className="frame tela-real">
      <div className="tela-real-img" style={{ aspectRatio: `${src.width} / ${src.height}` }}>
        <Image src={src} alt={alt} sizes="(max-width: 1023px) 100vw, 55vw" />
      </div>
    </div>
  );
}
