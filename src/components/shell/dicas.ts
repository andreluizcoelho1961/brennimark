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

  // ─── Etapa 2: os controles dentro das ferramentas (15/10/2026, aprovados) ──
  "kit-arquivo": { pt: "Envie o arquivo do logo (SVG ou PDF dá o melhor resultado).", en: "Upload the logo file (SVG or PDF gives the best result)." },
  "kit-fundo": { pt: "O fundo dos ícones e imagens que o Kit gera.", en: "The background of the icons and images the Kit makes." },
  "kit-margem": { pt: "O espaço livre em volta do logo, dentro de cada imagem.", en: "The free space around the logo, inside each image." },
  "kit-aba": { pt: "Os arquivos de cada destino, com prévia de como ficam.", en: "Each destination's files, with a preview." },
  "kit-baixar-grupo": { pt: "Baixa só os arquivos da aba aberta, num .zip.", en: "Downloads only the open tab's files, as a .zip." },
  "kit-baixar-tudo": { pt: "Baixa o kit inteiro, num .zip organizado por pasta.", en: "Downloads the whole kit, as a .zip organized by folder." },
  "kit-copiar": { pt: "Copia a assinatura pronta para colar no Gmail, Outlook ou Apple Mail.", en: "Copies the signature, ready to paste into Gmail, Outlook or Apple Mail." },
  "kit-versao": { pt: "Escolha qual versão dos Materiais o Kit usa.", en: "Choose which Materials version the Kit uses." },
  "kit-confirmar": { pt: "Aprova o valor que a IA leu do manual.", en: "Approves the value the AI read from the manual." },
  "cores-conta-gotas": { pt: "Pegue uma cor de qualquer lugar da tela.", en: "Pick a color from anywhere on the screen." },
  "cores-imagem": { pt: "Envie um print ou foto e clique na cor que quer medir.", en: "Upload a screenshot or photo and click the color to measure." },
  "cores-comparar": { pt: "Diz se a cor é da paleta da marca e qual a mais próxima.", en: "Tells whether the color is in the brand palette and which is closest." },
  "cores-contraste": { pt: "Mostra se o texto fica legível sobre essa cor (norma WCAG).", en: "Shows whether text is legible on this color (WCAG)." },
  "cores-daltonismo": { pt: "Simula como a cor aparece para quem tem daltonismo.", en: "Simulates how the color looks to people with color blindness." },
  "cores-copiar": { pt: "Copia o código (HEX, RGB, CMYK) para a área de transferência.", en: "Copies the code (HEX, RGB, CMYK) to the clipboard." },
  "cores-exportar": { pt: "Baixa as cores medidas, com os códigos.", en: "Downloads the measured colors, with the codes." },
  "grids-formato": { pt: "O tamanho da peça: impresso, rede social, digital ou apresentação.", en: "The piece size: print, social, digital or slides." },
  "grids-tipo": { pt: "O tipo de grid, da classificação de Timothy Samara.", en: "The grid type, from Timothy Samara's classification." },
  "grids-sobreposto": { pt: "Um segundo grid por cima do primeiro, para layouts mais livres.", en: "A second grid over the first, for freer layouts." },
  "grids-rotacionado": { pt: "O grid girado num ângulo, para composições dinâmicas.", en: "The grid turned at an angle, for dynamic compositions." },
  "grids-baixar-idml": { pt: "O .idml com o grid, o logo, as cores e as fontes, pronto para diagramar.", en: "The .idml with grid, logo, colors and fonts, ready to lay out." },
  // O grátis não leva a marca: dizer "logo, cores e fontes" ali seria falso.
  "grids-baixar-idml-gratis": { pt: "O .idml com o grid em camadas, pronto para diagramar.", en: "The .idml with the grid in layers, ready to lay out." },
  "grids-baixar-pdf": { pt: "O grid em PDF, para usar em outros programas.", en: "The grid as a PDF, for other programs." },
  "grids-canto": { pt: "Onde o logo entra na peça.", en: "Where the logo goes on the piece." },
  "grids-ajustar-margens": { pt: "Aumenta as margens até caber a área de proteção do logo.", en: "Widens the margins to fit the logo's clear space." },
  "grids-variante": { pt: "O manual traz vários grids: escolha qual usar (cada estrutura e segmento é um).", en: "The manual has several grids: choose which to use (each structure and segment is one)." },
  "grids-guardar": { pt: "Cria uma regra só para este formato, com estas medidas. Não é a aprovação do grid do manual.", en: "Saves these measurements as the brand's rule for this format." },
  "grids-aprovar-todos": { pt: "Aprova de uma vez todos os grids lidos do manual que estão em rascunho.", en: "Approves every grid read from the manual that is still a draft." },
  "grids-confirmar": { pt: "Aprova a regra de grid que veio do manual.", en: "Approves the grid rule that came from the manual." },
  ajuda: { pt: "O manual de uso da plataforma: abre o artigo da tela em que você está.", en: "The platform's user guide: opens the article for the screen you're on." },
  "como-usar": { pt: "O passo a passo desta ferramenta, sem sair da tela.", en: "This tool's step-by-step guide, without leaving the screen." },
  "admin-adicionar": { pt: "Cadastra à mão uma cor ou fonte do manual.", en: "Adds a manual color or font by hand." },
  "admin-ler-ia": { pt: "A IA lê as páginas do manual e preenche o que falta, como rascunho.", en: "The AI reads the manual pages and fills in what's missing, as drafts." },
  "admin-aprovar-conferidas": { pt: "Aprova as cores cujos códigos batem com o texto do manual.", en: "Approves the colors whose codes match the manual text." },
  "admin-aprovar-todos": { pt: "Aprova de uma vez tudo o que está em rascunho.", en: "Approves every draft at once." },
  "admin-editar": { pt: "Corrige esta linha; ela volta a rascunho até ser aprovada de novo.", en: "Fixes this line; it returns to draft until approved again." },
  "admin-remover": { pt: "Apaga esta linha (só rascunho pode ser apagado).", en: "Deletes this line (only drafts can be deleted)." },
} as const;

export type ChaveDaDica = keyof typeof DICAS;

export function textoDaDica(chave: string, ingles: boolean): string | null {
  const d = (DICAS as Record<string, { pt: string; en: string }>)[chave];
  return d ? (ingles ? d.en : d.pt) : null;
}
