import { FORMAS, LETREIRO } from "@/components/site/Simbolos";
import { platformIdentity } from "@/platform/identity";

/**
 * O logo oficial do Brennimark na moldura da plataforma (09/10/2026, pedido do
 * André). Mesmos traços do site (`site/Simbolos.tsx`): o símbolo com o degradê
 * BRASA — o único lugar da moldura onde a Brasa aparece — e o letreiro na cor
 * do texto da moldura, que acompanha o tema.
 *
 * SVG em linha, com ids de degradê próprios: a moldura não carrega o sprite do
 * site, e ids repetidos na mesma página fariam um logo pintar com o degradê do
 * outro.
 *
 * `soSimbolo`: só a marca, sem o letreiro — para o celular estreito, onde o
 * logo inteiro empurraria a barra para fora da tela (320 px, `smoke.spec`).
 */
export function LogoDaPlataforma({ className = "", soSimbolo = false }: { className?: string; soSimbolo?: boolean }) {
  const id = soSimbolo ? "bm-moldura-s" : "bm-moldura";
  return (
    <svg
      data-logo-da-plataforma={soSimbolo ? "simbolo" : "completo"}
      viewBox={soSimbolo ? "40 55 178 162" : "30 50 750 170"}
      role="img"
      aria-label={platformIdentity.displayName}
      className={className}
    >
      <defs>
        <linearGradient id={`${id}-g0`} x1="104.54" y1="153.52" x2="174.62" y2="75.74" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ad2e01" />
          <stop offset=".28" stopColor="#cf3601" />
          <stop offset=".56" stopColor="#e93d01" />
          <stop offset=".8" stopColor="#f84101" />
          <stop offset="1" stopColor="#fe4301" />
        </linearGradient>
        <linearGradient id={`${id}-g1`} x1="145.32" y1="85.42" x2="184.06" y2="125.13" href={`#${id}-g0`} />
        <linearGradient id={`${id}-g2`} x1="-268.49" y1="46.38" x2="-198.42" y2="-31.4" gradientTransform="translate(-115.72 165.44) rotate(-180)" href={`#${id}-g0`} />
        <linearGradient id={`${id}-g3`} x1="-227.72" y1="-21.73" x2="-188.97" y2="17.99" gradientTransform="translate(-115.72 165.44) rotate(-180)" href={`#${id}-g0`} />
      </defs>
      {FORMAS.map((d, i) => (
        <path key={d} fill={`url(#${id}-g${i})`} d={d} />
      ))}
      {!soSimbolo && (
        <g fill="currentColor">
          {LETREIRO.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      )}
    </svg>
  );
}
