/**
 * A silhueta do símbolo ao fundo, em profundidade. `velocidade` é quanto ela
 * anda em relação ao conteúdo quando a página rola (ver `ComportamentoDoSite`);
 * sem movimento, fica parada onde o CSS a pôs.
 */
export function Losango({ classe, velocidade }: { classe: "l1" | "l2" | "l3" | "l4"; velocidade: number }) {
  return (
    <div className={`loz ${classe}`} data-speed={velocidade} aria-hidden="true">
      <svg viewBox="0 0 178 162">
        <use href="#bm-silhueta" />
      </svg>
    </div>
  );
}
