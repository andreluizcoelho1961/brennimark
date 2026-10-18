"use client";

import { useState } from "react";
import { FormularioDeCadastro } from "@/components/ferramentas/CadastroParaBaixar";

/**
 * O pedido de convite do beta do Fonts (17/10/2026): o botão da página `/fonts`
 * abre o mesmo cadastro das ferramentas, em modo `convite`. O pedido cai na
 * mesma lista, marcado como pedido do Fonts (ver `comMarcaDoConvite`), e o
 * convite sai à mão, por e-mail, na ordem do pedido.
 */
export function PedirConviteDoFonts({ rotulo }: { rotulo: string }) {
  const [aberto, setAberto] = useState(false);
  const [feito, setFeito] = useState(false);

  if (feito) {
    return (
      <p data-fonts-pedido-feito role="status" className="fx-pedido">
        <b>Pedido recebido.</b> Vamos avaliar e escrever para você, na ordem dos pedidos. As vagas são 50.
      </p>
    );
  }
  return (
    <>
      <button className="btn" type="button" data-fonts-pedir onClick={() => setAberto(true)}>
        {rotulo} <span className="arrow" aria-hidden="true">↗</span>
      </button>
      {aberto && <FormularioDeCadastro origem="fonts" variante="convite" aoConcluir={() => { setAberto(false); setFeito(true); }} aoFechar={() => setAberto(false)} />}
    </>
  );
}
