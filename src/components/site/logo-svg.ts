import { FORMAS, LETREIRO } from "./Simbolos";

/**
 * O logo oficial como texto SVG autônomo, para onde `<use href>` não chega —
 * a imagem de prévia de link, gerada no build, não enxerga os símbolos da
 * página. Mesmos traços e degradê de `Simbolos.tsx`.
 */
export function logoSvg(corDoLetreiro: string): string {
  const degrade = `
    <linearGradient id="g0" x1="104.54" y1="153.52" x2="174.62" y2="75.74" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ad2e01"/><stop offset=".28" stop-color="#cf3601"/><stop offset=".56" stop-color="#e93d01"/><stop offset=".8" stop-color="#f84101"/><stop offset="1" stop-color="#fe4301"/>
    </linearGradient>
    <linearGradient id="g1" x1="145.32" y1="85.42" x2="184.06" y2="125.13" href="#g0"/>
    <linearGradient id="g2" x1="-268.49" y1="46.38" x2="-198.42" y2="-31.4" gradientTransform="translate(-115.72 165.44) rotate(-180)" href="#g0"/>
    <linearGradient id="g3" x1="-227.72" y1="-21.73" x2="-188.97" y2="17.99" gradientTransform="translate(-115.72 165.44) rotate(-180)" href="#g0"/>`;
  const simbolo = FORMAS.map((d, i) => `<path fill="url(#g${i})" d="${d}"/>`).join("");
  const letreiro = LETREIRO.map((d) => `<path d="${d}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="30 50 750 170"><defs>${degrade}</defs>${simbolo}<g fill="${corDoLetreiro}">${letreiro}</g></svg>`;
}
