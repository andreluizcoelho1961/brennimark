/**
 * As dicas dos menus — 15/10/2026, pedido do André: "cada ferramenta, passa o
 * mouse e tem a dica do que faz", para a plataforma ser intuitiva sem manual
 * de instrução. Os textos foram aprovados por ele; ficam todos aqui para
 * mudar num lugar só.
 *
 * A chave é o ícone do item na coluna (`IconeDaColuna`) ou o nome do controle.
 */
export const DICAS = {
  manual: { pt: "O manual da marca em PDF, página por página, com índice e busca.", en: "The brand manual as a PDF, page by page, with index and search." },
  materiais: { pt: "Logos, imagens e arquivos da marca, prontos para baixar.", en: "Brand logos, images and files, ready to download." },
  complementos: { pt: "Regras que o manual não cobre, escritas pela marca.", en: "Rules the manual doesn't cover, written by the brand." },
  marcas: { pt: "Todas as marcas da sua conta. Escolha uma para abrir o manual.", en: "All the brands in your account. Pick one to open its manual." },
  kit: { pt: "O logo em todos os tamanhos de site, redes, e-mail e apresentação.", en: "The logo in every size for site, social, email and slides." },
  cores: { pt: "Mede qualquer cor e diz se ela é da marca, com os códigos.", en: "Measures any color and tells whether it's the brand's, with the codes." },
  grids: { pt: "Monta o documento do InDesign com o grid, o logo, as cores e as fontes da marca.", en: "Builds the InDesign document with the brand's grid, logo, colors and fonts." },
  importar: { pt: "Traga um manual em PDF para criar uma marca nova.", en: "Bring a PDF manual in to create a new brand." },
  administracao: { pt: "Páginas do manual, paleta, tipografia e materiais da marca.", en: "Manual pages, palette, typography and materials of the brand." },
  pessoas: { pt: "Quem entra em cada marca e o que cada pessoa pode fazer.", en: "Who gets into each brand and what each person can do." },
  links: { pt: "Links com prazo para enviar materiais a quem não tem conta.", en: "Expiring links to send materials to people without an account." },
  registros: { pt: "Quem acessou, baixou e mudou o quê, e quando.", en: "Who accessed, downloaded and changed what, and when." },
  configuracoes: { pt: "Nome da conta, plano e cobrança.", en: "Account name, plan and billing." },
  ia: { pt: "Os ajustes desta marca.", en: "This brand's settings." },
  assistente: { pt: "Converse com o Vini sobre a marca.", en: "Talk to Vini about the brand." },
  analise: { pt: "Envie uma peça e o Vini confere se ela segue o manual.", en: "Send a piece and Vini checks it against the manual." },
  historico: { pt: "As conversas anteriores com o Vini.", en: "Your earlier conversations with Vini." },
  busca: { pt: "Procure qualquer regra no manual da marca.", en: "Search any rule in the brand manual." },
  tema: { pt: "Alterna entre o tema claro e o escuro.", en: "Switches between the light and dark theme." },
  vini: { pt: "Pergunte qualquer coisa sobre a marca; o Vini responde citando a página do manual.", en: "Ask anything about the brand; Vini answers citing the manual page." },
} as const;

export type ChaveDaDica = keyof typeof DICAS;

export function textoDaDica(chave: string, ingles: boolean): string | null {
  const d = (DICAS as Record<string, { pt: string; en: string }>)[chave];
  return d ? (ingles ? d.en : d.pt) : null;
}
