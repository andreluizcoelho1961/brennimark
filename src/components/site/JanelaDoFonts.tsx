/**
 * A janela do Brennimark Fonts, desenhada (23/10/2026). Usada na página /fonts e
 * no capítulo do Fonts da home. É um desenho: o aplicativo é um programa do
 * computador (não roda no navegador), e esta tela mostra o que o beta faz hoje —
 * famílias de uma marca, um kit pronto para ativar e um conflito de nomes avisado.
 */
export function JanelaDoFonts() {
  return (
      <div className="frame"><div className="mk" role="img" aria-label="Janela do Brennimark Fonts: famílias de uma marca, com um kit pronto para ativar e um conflito de nomes avisado"><div className="mk-bar"><b>Brennimark Fonts</b><span className="a-direita mono" style={{ fontSize: "10px", color: "var(--app-muted)" }}>Beta</span></div><div className="mk-body fx-demo">
      <div><b>Kit · Marca Exemplo</b><span>3 famílias · 11 estilos</span><em>Ativar kit</em></div>
      <div><b>Serifada Display</b><span>5 estilos · ativa</span><em>Desativar</em></div>
      <div><b>Sans Texto</b><span>6 estilos · inativa</span><em>Ativar</em></div>
      <div className="fx-aviso"><b>Conflito de nome</b><span>Outra Sans Texto já está ativa</span><em>Ver diferença</em></div></div></div></div>
  );
}
