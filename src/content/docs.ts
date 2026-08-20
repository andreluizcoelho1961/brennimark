import type { DocBlock } from "./doc-blocks";

export type { DocBlock };

export type DocStatus = "ready" | "draft" | "pending";

export interface DocPageImage {
  /** Path under /public, e.g. "/brand/mockups/poster-01.jpg" */
  src: string;
  alt: string;
  caption?: string;
}

export interface DocPageEntry {
  /** URL path segments, e.g. "nucleo-da-marca/posicionamento" */
  slug: string;
  group: string;
  title: string;
  status: DocStatus;
  /** Prose paragraphs for the generic DocPage renderer. Ignored for
   * slugs that have a custom component (see COMPONENT_SLUGS in the
   * [...slug] route). */
  body?: string[];
  /** Reference images/mockups rendered as a grid below the body text.
   * Drop files under public/brand/<group-folder>/ and list them here —
   * see public/brand/README.md for the folder convention. */
  images?: DocPageImage[];
  /** Structured visual content, rendered after `body` and before `images`.
   * Absent means the page renders exactly as it did before blocks existed. */
  blocks?: readonly DocBlock[];
}

export const GROUPS = [
  "Início",
  "Overview",
  "Núcleo do Artista",
  "Universo Verbal",
  "Universo Visual",
  "Universo Sonoro",
] as const;

/** Two-letter rail codes for the collapsed nav — must stay unique. */
export const GROUP_CODES: Record<(typeof GROUPS)[number], string> = {
  Início: "IN",
  Overview: "OV",
  "Núcleo do Artista": "NA",
  "Universo Verbal": "VB",
  "Universo Visual": "VS",
  "Universo Sonoro": "SN",
};

export const docsRegistry: DocPageEntry[] = [
  // ---- Início ----
  {
    slug: "introducao",
    group: "Início",
    title: "Introdução",
    status: "draft",
    body: [
      "Brandville é um formato novo de brand book. O formato de sempre — um PDF apresentado uma vez, aplaudido na reunião e esquecido numa pasta — envelhece no dia seguinte e não responde pergunta nenhuma. Aqui a identidade é um sistema vivo: se navega, se busca, se atualiza quando o trabalho muda, e se pergunta a ela diretamente. Há um assistente treinado neste próprio conteúdo, que responde sobre o projeto e analisa peças contra o que está documentado.",
      "Esta é a instância do The BluesMaker: o que o projeto é, como soa, como se parece e como fala. Ela existe para que qualquer pessoa trabalhando nele — o artista, o estúdio, um colaborador, uma futura contratação — tome as mesmas decisões da mesma forma, sem precisar rederivar tudo do zero a cada vez.",
      "E cada lançamento acrescenta camada a ele. O sistema acompanha o trabalho em vez de congelar um retrato dele num único momento — é exatamente por isso que vive aqui, e não num arquivo fechado.",
    ],
  },
  {
    slug: "definicao",
    group: "Início",
    title: "Definição",
    status: "ready",
    body: [
      "The BluesMaker é um artista — um projeto autoral de blues contemporâneo, de André Coelho. A distinção importa: um artista não é um produto que precisa de uma marca para se diferenciar de outros iguais. A obra é a coisa em si. Tudo que este documento organiza existe para servir a ela, não para embrulhá-la.",
      "Por isso o que o público vê é exclusivamente a música: canções, lançamentos, vídeos oficiais, letras, créditos, streaming, apresentações ao vivo e a comunicação direta do artista. Não há uma camada de discurso institucional entre o ouvinte e o disco.",
      "A interface existe para amplificar a música — nunca para competir com ela. Toda decisão de design é julgada contra essa frase.",
    ],
  },

  // ---- Overview ----
  {
    slug: "overview/visao-geral",
    group: "Overview",
    title: "Visão Geral",
    status: "draft",
    body: [
      "The BluesMaker é um projeto solo de blues urbano contemporâneo, de André Coelho — cantor, guitarrista, compositor, diretor criativo e designer visual. O que chega ao público é só a música, não o processo ou o estúdio por trás dela.",
      "Personalidade: calma, elegante, inteligente, reflexiva, urbana, honesta, madura — e deliberadamente distante de três registros: o nostálgico, o corporativo e o exagerado. Nenhum desses adjetivos é decorativo; cada um vira critério real de decisão (ver Núcleo do Artista e Universo Verbal).",
      "Lançamento atual: o álbum Analog Man, precedido por singles — o primeiro é \"Call Me Analog Man\".",
    ],
  },
  {
    slug: "overview/por-que-existe",
    group: "Overview",
    title: "Por que existe",
    status: "draft",
    body: [
      "Propósito: criar blues contemporâneo que fala sobre a vida moderna sem abrir mão da linguagem emocional do blues tradicional.",
      "Missão: produzir música, imagem e histórias que conectem autenticidade, ofício (craftsmanship) e emoção humana.",
      "Visão: tornar-se um artista de blues contemporâneo reconhecido internacionalmente, com uma identidade visual distintiva.",
    ],
  },
  {
    slug: "overview/cuidados-e-riscos",
    group: "Overview",
    title: "Cuidados e Riscos",
    status: "ready",
    body: [
      "O risco central é de deslocamento: o projeto é sobre a música, e tudo que o apresenta como outra coisa o tira do lugar. Quando o material começa a falar de estúdio de design, metodologia, projeto de tecnologia, experimento de IA ou laboratório de sistema visual, o assunto deixou de ser o disco — mesmo que o texto esteja bom.",
      "O mesmo vale para a forma. Quando a página começa a se parecer com landing page de SaaS, portfólio de design, vitrine de IA, template genérico de blues, site retrô, página corporativa de artista ou coleção de efeitos da moda, ela está pedindo atenção para si mesma em vez de entregar a música.",
      "O teste, em qualquer caso de dúvida: isso está falando da música, ou está falando de quem fez?",
    ],
  },
  {
    slug: "overview/nossa-postura",
    group: "Overview",
    title: "Nossa Postura",
    status: "draft",
    body: [
      "The BluesMaker não persegue novidade. Cada escolha de layout, cada transição, cada linha de texto é julgada por uma pergunta: isso ajuda alguém a chegar mais rápido na música, ou isso atrapalha?",
      "O projeto usa tecnologia como ferramenta de produção — nunca como estilo. Quando IA é usada, ela dirige e edita; não autora. O público deve perceber direção, não geração.",
      "Isso é uma postura, não um slogan: quando uma solução parece genérica, a resposta é desacelerar e escolher de novo — não lançar a primeira ideia que funciona.",
    ],
  },
  {
    slug: "overview/o-preco-que-pagamos",
    group: "Overview",
    title: "O preço que pagamos",
    status: "draft",
    body: [
      "O projeto recusa três atalhos, e cada recusa custa alcance fácil: o nostálgico (abre mão do apelo imediato do revival e do colecionismo vintage), o corporativo (abre mão da linguagem polida de mercado que facilitaria parcerias genéricas) e o exagerado (abre mão do volume e do sensacionalismo que o algoritmo recompensa).",
      "No visual, o mesmo preço: sem clichês de blues, sem estereótipos vintage, sem estética genérica de IA — mesmo quando seriam mais rápidos, mais baratos ou mais reconhecíveis à primeira vista.",
      "Independência é uma das seis virtudes do projeto: sustentar essas recusas é literalmente o custo de mantê-la.",
    ],
  },
  {
    slug: "overview/principios",
    group: "Overview",
    title: "Princípios",
    status: "draft",
    body: [
      "Cor tem função, nunca decoração.",
      "Tipografia carrega hierarquia através de escala e peso, não de ornamento.",
      "Movimento revela hierarquia; nunca performa por conta própria.",
      "Inglês é a voz canônica; nada é traduzido automaticamente.",
      "Todo asset remonta a algo real — uma foto, uma letra, uma cor amostrada da capa de verdade — nunca inventado do zero.",
    ],
  },
  {
    slug: "overview/linha-do-tempo",
    group: "Overview",
    title: "Linha do Tempo",
    status: "draft",
    body: [
      "1989 — Fundação original como The Bluesmakers.",
      "Hoje — o projeto segue como The BluesMaker, artista solo de André Coelho (voz, guitarra, composição, direção criativa e visual).",
      "13 de agosto de 2026 — lançamento de \"Call Me Analog Man\", primeiro single do álbum Analog Man. A estratégia de lançamento prioriza singles antes do álbum completo.",
      "Linha do tempo mínima, construída a partir do que já se sabe sobre a origem e o lançamento atual — datas intermediárias entre 1989 e hoje ainda não foram documentadas aqui.",
    ],
  },

  // ---- Núcleo do Artista ----
  {
    slug: "nucleo-da-marca/posicionamento",
    group: "Núcleo do Artista",
    title: "Posicionamento",
    status: "draft",
    body: [
      "Blues moderno para pessoas que ainda valorizam a expressão humana em um mundo digital.",
      "Público primário: adultos de 30 a 65 anos interessados em blues, jazz, vinil, fotografia, design, arquitetura, cinema e cultura.",
      "Gênero: blues urbano contemporâneo. Formato: artista solo — The BluesMaker é o projeto de André Coelho (voz, guitarra, composição, direção criativa e visual), herdeiro direto do The Bluesmakers fundado em 1989.",
    ],
  },
  {
    slug: "nucleo-da-marca/visao-e-proposito",
    group: "Núcleo do Artista",
    title: "Visão e Propósito",
    status: "draft",
    body: [
      "Propósito — declaração canônica: criar blues contemporâneo que fala sobre a vida moderna sem abrir mão da linguagem emocional do blues tradicional.",
      "Visão — declaração canônica: tornar-se um artista de blues contemporâneo reconhecido internacionalmente, com uma identidade visual distintiva.",
      "Estas são as versões formais das mesmas respostas registradas em Overview / Por que existe — aqui como referência oficial do Núcleo do Artista.",
    ],
  },
  {
    slug: "nucleo-da-marca/storybrand",
    group: "Núcleo do Artista",
    title: "Storybrand",
    status: "draft",
    body: [
      "Herói: o ouvinte. Alguém vivendo num mundo cada vez mais rápido, digital e superficial, que ainda busca experiências humanas autênticas.",
      "Problema externo: a música virou descartável, as relações viraram superficiais, tudo se move rápido demais. Problema interno: o ouvinte quer se reconectar com emoção, sentido e autenticidade. Problema filosófico: tecnologia deveria amplificar a humanidade, não substituí-la.",
      "Guia: The BluesMaker não é o herói — é o guia. Alguém que já percorreu esse caminho e ainda acredita na expressão artística honesta.",
      "Plano: ouvir, desacelerar, refletir, reconectar. Chamada à ação: toca, escuta, sente.",
      "Sucesso: o blues deixa de ser apenas um gênero musical e passa a ser um jeito de entender a vida moderna.",
    ],
  },
  {
    slug: "nucleo-da-marca/virtudes",
    group: "Núcleo do Artista",
    title: "Virtudes",
    status: "draft",
    body: [
      "Autenticidade — Humanidade — Simplicidade — Ofício (Craftsmanship) — Independência — Atemporalidade.",
      "Essas seis virtudes vieram diretamente do briefing de fundação do projeto, sem interpretação adicional — não são um exercício de branding aplicado depois, são como o artista já descreve o próprio trabalho.",
    ],
  },
  {
    slug: "nucleo-da-marca/arquetipos",
    group: "Núcleo do Artista",
    title: "Arquétipos",
    status: "draft",
    body: [
      "A personalidade documentada do projeto é: calma, elegante, inteligente, reflexiva, urbana, honesta, madura — e explicitamente nunca nostálgica, nunca corporativa, nunca exagerada.",
      "A partir desses traços, uma leitura possível de arquétipo (Sábio, com traços de Criador — inteligência reflexiva combinada com ofício/craftsmanship) parece a mais próxima. Isso é uma interpretação para reagir, não uma escolha de arquétipo formalizada — arquétipo costuma ser decisão deliberada, feita em conjunto, não deduzida de uma lista de adjetivos de personalidade.",
    ],
  },
  {
    slug: "nucleo-da-marca/proxies",
    group: "Núcleo do Artista",
    title: "Proxies",
    status: "draft",
    body: [
      "Referências musicais diretas — o que o projeto quer evocar: B.B. King, Bobby Bland, Magic Sam, Albert King, Marvin Gaye, Sade. As quatro primeiras ancoram o blues elétrico de verdade; Marvin Gaye e Sade ancoram a elegância contida e o acabamento soul que diferenciam o projeto do revival.",
      "Referências de universo cultural — onde o público do projeto já vive: vinil, fotografia, design, arquitetura, cinema. O trabalho deve se sentir em casa nesses contextos, e não no de nostalgia de bar temático.",
      "Referências que puxam para o lugar errado: clichê de blues, estereótipo vintage, estética genérica de IA. Elas aparecem sozinhas quando falta direção — são o caminho de menor resistência do gênero, e é justamente por isso que não distinguem nada.",
    ],
  },

  // ---- Universo Verbal ----
  {
    slug: "universo-verbal/manifesto",
    group: "Universo Verbal",
    title: "Manifesto",
    status: "draft",
    body: [
      "A gente não cresceu online. Cresceu alto, em sala com luz ruim e amplificador bom, e um pouco disso nunca saiu.",
      "O mundo foi ficando digital. A gente não rejeitou. Só começou a perguntar o que vale a pena manter no meio do caminho — que é a pergunta inteira por trás de Call Me Analog Man.",
      "Pode chamar de analógico se quiser. Nunca foi fita contra arquivo. É se a decisão ainda tem uma mão humana por trás dela, não importa como o som é feito.",
      "Old tube fire, new world. Still playing low.",
      "Este é um primeiro rascunho de manifesto, escrito a partir do tema real da música (\"remaining human in a world increasingly mediated by technology\") e de imagens que já existem na letra — não uma peça final aprovada.",
    ],
  },
  { slug: "universo-verbal/tom-de-voz", group: "Universo Verbal", title: "Tom de Voz", status: "ready" },
  {
    slug: "universo-verbal/vocabulario",
    group: "Universo Verbal",
    title: "Vocabulário",
    status: "draft",
    body: [
      "O vocabulário do projeto: analog, direction, restraint, groove, low(-down), soul, tube (fire), freedom, human, direct, precise.",
      "Fora dele fica a linguagem que promete em vez de mostrar: revolutionary, groundbreaking, legendary, unique experience, passion-driven, authentic journey, \"where analog meets digital\", \"a journey through time\", jargão corporativo de marca, prosa verborrágica gerada por IA. Nenhuma dessas palavras diz nada sobre a música — todas pedem que se acredite em algo antes de ouvir.",
      "Isso é registro de voz, não restrição de assunto. Apresentar algo novo é legítimo e desejável: diga o que é e o que faz de diferente, com o concreto no lugar do adjetivo. O julgamento (\"inovador\") funciona melhor vindo de quem lê.",
    ],
  },
  {
    slug: "universo-verbal/territorio-de-palavras",
    group: "Universo Verbal",
    title: "Território de Palavras",
    status: "draft",
    body: [
      "A letra de \"Call Me Analog Man\" já traça o mapa verbal do projeto sozinha — uma dualidade entre quente/analógico e frio/virtual que se repete a cada verso.",
      "Quente / Analógico: Analog Man, old tube fire, low-down blues, an old blues song, soul, groove, guitar cry, freedom (that money can't buy).",
      "Frio / Virtual: virtual world, virtual town, neon glows, a little screen, a plastic dream, a business plan (usado de forma irônica).",
      "Esse território é extraído diretamente da letra real — não é uma lista de palavras-chave inventada para SEO ou branding.",
    ],
  },
  {
    slug: "universo-verbal/glossario",
    group: "Universo Verbal",
    title: "Glossário",
    status: "draft",
    body: [
      "The BluesMaker — nome artístico do projeto autoral de blues contemporâneo. A caixa do \"M\" pode variar entre plataformas (\"The BluesMaker\", \"The Bluesmaker\") sem que isso seja erro: em caixa alta, como na arte das capas, a distinção nem existe. Não vale o trabalho de uniformizar retroativamente onde já foi publicado.",
      "Call Me Analog Man — primeiro single, lançamento em 13 de agosto de 2026.",
      "Gotham — família tipográfica licenciada do projeto (pesos Book, Medium, Bold, Black).",
      "Foundation, Voice, Neutral — os papéis de cor permanentes do artista (preto, branco quente, cinza). Accent-Turquoise, Accent-Blue, Echo — os acentos específicos de \"Call Me Analog Man\", que mudam a cada lançamento (ver Guia de Cores).",
      "Camada estrutural / camada expressiva — a divisão que define o que é permanente na identidade visual e o que varia por single (ver Universo Visual / Overview).",
      "Brandville — este documento: a referência viva do The BluesMaker.",
    ],
  },
  {
    slug: "universo-verbal/arquitetura-de-marca",
    group: "Universo Verbal",
    title: "Arquitetura do Projeto",
    status: "draft",
    body: [
      "Estrutura de produto: singles, álbuns, videoclipes, apresentações ao vivo, merchandise, fotografia e conteúdo editorial — todos sob o nome único The BluesMaker, sem sub-marcas.",
      "O ciclo de lançamento vai do single para o álbum: os singles saem primeiro e o álbum se forma a partir deles. \"Call Me Analog Man\" é o primeiro single do ciclo que resultará no álbum Analog Man.",
      "Cada single é uma unidade visual própria: recebe sua própria paleta, amostrada da sua própria arte. O álbum não descarta isso — ele chega depois carregando o acúmulo dos singles que o formaram, do mesmo jeito que musicalmente ele é formado por eles.",
      "Paleta do álbum: normalmente o álbum assume a paleta do single que funciona como carro-chefe daquele ciclo, e os outros singles seguem com as suas. Em Analog Man o carro-chefe foi \"Call Me Analog Man\" desde o começo — daí o turquesa e o azul. Mas isso é orientação, não fórmula: um ciclo pode ter dois singles igualmente fortes, ou o álbum pode pedir uma cor própria. A escolha é editorial, feita a cada ciclo.",
      "Nomeação: no ciclo atual os singles herdam o território do álbum-mãe (\"Analog Man\" → \"Call Me Analog Man\"). É um padrão que funcionou aqui, não uma exigência para os próximos.",
      "O que de fato não muda é a camada estrutural (ver Universo Visual). O resto é território de decisão artística — o sistema existe para dar continuidade, não para limitar o que cada disco pode ser.",
    ],
  },

  // ---- Universo Visual ----
  {
    slug: "universo-visual/overview",
    group: "Universo Visual",
    title: "Overview",
    status: "draft",
    body: [
      "O sistema visual opera em duas camadas. Essa separação é a decisão estrutural mais importante do universo visual — ela permite que cada lançamento tenha personalidade própria sem fragmentar a identidade do artista.",
      "Camada estrutural (permanente, vale para todo lançamento): composição editorial, fotografia em primeiro lugar, grids fortes, espaço em branco, tipografia grotesk, alto contraste. Preto e branco são as cores permanentes — não uma base neutra sobre a qual a cor real acontece.",
      "Camada expressiva (variável por lançamento): cada single tem suas próprias cores, amostradas da arte daquele lançamento. Turquesa e azul são os acentos de \"Call Me Analog Man\" — não a cor permanente do artista. O próximo single pode ter uma paleta completamente diferente sem que nada da camada estrutural mude.",
      "Isso acompanha o próprio ciclo de lançamento, que vai do single para o álbum (ver Arquitetura do Projeto): cada single ganha identidade visual própria e reconhecível, e o álbum normalmente assume a paleta do single que puxou o ciclo — sem que isso vire fórmula. A camada estrutural é o que mantém tudo legível como um único artista; a camada expressiva existe justamente para dar espaço a cada disco ser o que precisa ser.",
      "Fotografia: preto e branco como fundação, com tratamentos duotone opcionais por campanha. Tipografia: Gotham (ou grotesk moderna equivalente) como família primária. Toda cor da era atual é amostrada de um artefato real — a capa de Call Me Analog Man — nunca estimada.",
      "Movimento é fluido e contido: 150ms para hover e transições de CTA, 300ms para transições de seção, 600ms para revelações maiores, 900ms para entradas editoriais completas, sempre com easing cubic-bezier(0.22, 1, 0.36, 1). O repertório é curto de propósito — revelação de texto e imagem, transição de seção, hover de link, mudança de estado de CTA, máscara sutil, ajuste controlado de cor e contraste, transições de header fixo.",
      "Fora desse repertório fica o movimento que performa por conta própria: vídeo autoplay no hero, carrosséis, sistemas de partículas, ruído animado, dano de filme falso, waveforms decorativas, glitch aleatório, coreografia pesada de scroll. O critério é sempre o mesmo — movimento revela hierarquia; quando ele vira o assunto, está atrapalhando a música.",
    ],
  },
  {
    slug: "universo-visual/imagens-arquetipicas",
    group: "Universo Visual",
    title: "Imagens Arquetípicas",
    status: "draft",
    body: [
      "Estilo fotográfico: documental, analógico, luz dramática, tratamento editorial. As palavras-chave do DNA visual: preto, branco, editorial, minimal, urbano, film grain, tipografia forte, fotografia documental.",
      "Preto e branco é a fundação permanente da fotografia. Tratamentos duotone são opcionais e específicos por lançamento — o duotone turquesa/azul pertence a Call Me Analog Man, não à marca em caráter permanente (ver Overview do Universo Visual).",
      "O que desloca a imagem desse lugar: clichê de blues, estereótipo vintage e o acabamento genérico de imagem gerada por IA. Os três empurram a fotografia para o território de ilustração de gênero — e o que se busca aqui é o oposto, alguém real registrado com honestidade documental.",
    ],
  },
  {
    slug: "universo-visual/painel-semantico",
    group: "Universo Visual",
    title: "Painel Semântico",
    status: "draft",
    body: [
      "Azul e turquesa frios se lêem como lúcidos, não nostálgicos — deliberadamente não o clichê preto-e-âmbar do blues genérico. Preto combinado com um branco quente (não branco puro) se lê estrutural sem ficar frio ou corporativo.",
      "O caráter geométrico e caixa-alta da Gotham se lê editorial e confiante, não decorativo nem \"pôster vintage de blues\". A fotografia duotone mantém o artista reconhecivelmente humano e presente, sem o acabamento glamourizado de um ensaio promocional genérico.",
      "Juntas, essas escolhas tentam dizer uma coisa só: contemporâneo, não nostálgico; dirigido, não gerado.",
    ],
  },
  { slug: "universo-visual/simbolos-e-logotipos", group: "Universo Visual", title: "Símbolos e Logotipos", status: "ready" },
  { slug: "universo-visual/guia-de-cores", group: "Universo Visual", title: "Guia de Cores", status: "ready" },
  { slug: "universo-visual/tipografia", group: "Universo Visual", title: "Tipografia", status: "ready" },
  {
    slug: "universo-visual/iconografia",
    group: "Universo Visual",
    title: "Iconografia",
    status: "draft",
    body: [
      "O projeto trabalha com um set único de 100 ícones de linha — traço uniforme, sem preenchimento, sem ornamento. Vir tudo da mesma mão é o ponto: misturar ícones de origens diferentes num mesmo layout é o que denuncia um sistema improvisado.",
      "Princípios de desenho: geometria simples, traço uniforme, detalhe mínimo, superfície chapada (sem gradiente ou volume falso), aparência editorial.",
      "A hierarquia continua valendo: o peso expressivo da marca está na fotografia e na tipografia. O ícone orienta e acompanha — em interface, em créditos, em material de apoio — sem assumir o papel de assinatura, que é do wordmark.",
    ],
  },
  {
    slug: "universo-visual/grafismos",
    group: "Universo Visual",
    title: "Grafismos",
    status: "draft",
    body: [
      "A linguagem gráfica é construída a partir de um conjunto pequeno de elementos recorrentes — a repetição é o que cria reconhecimento.",
      "O repertório: film grain, meios-tons sutis, grids editoriais, tipografia grande, linhas finas, crops fotográficos fortes, blocos geométricos sólidos, espaço em branco generoso.",
      "Fora do repertório ficam os elementos que contam uma história de blues que não é a deste projeto: chamas, fumaça, ornamentos vintage, imagética nostálgica do gênero. Não há nada de errado com eles em si — eles já pertencem a outro trabalho, e usá-los faz este ser lido como aquele.",
      "Sobre instrumentos e notação: eles existem no set de ícones (ver Iconografia) e são legítimos ali, onde a função é orientar. O que os desloca é o uso ornamental — uma guitarra como enfeite de layout, uma clave como assinatura. A distinção não é o motivo, é o papel que ele cumpre.",
      "Convivência com a imagem: grafismo aqui é ritmo, não protagonismo. Ele organiza a página para a fotografia funcionar; quando disputa atenção com ela, perdeu a função.",
    ],
  },

  // ---- Universo Sonoro ----
  {
    slug: "universo-sonoro/universo-sonoro",
    group: "Universo Sonoro",
    title: "Universo Sonoro",
    status: "draft",
    body: [
      "The BluesMaker é uma banda de verdade, não uma construção de estúdio: voz e guitarra solo, guitarra base, baixo, teclados, bateria — cinco pessoas tocando juntas, creditadas nominalmente em cada lançamento. Call Me Analog Man foi gravada no Soma Music Hub, em Porto Alegre, e mixada e masterizada no Rabbit Hole.",
      "Sonoramente, o projeto vive no blues contemporâneo: amplificador de verdade, \"old tube fire\" de verdade — a imagem da letra não foi tirada do nada, é literalmente como o timbre da guitarra é feito — não um pastiche nostálgico do gênero. O som deve soar humano e tocado, do mesmo jeito que o sistema visual insiste em ser dirigido, não gerado.",
    ],
  },
  {
    slug: "universo-sonoro/identidade-sonora",
    group: "Universo Sonoro",
    title: "Identidade Sonora",
    status: "draft",
    body: [
      "Influências diretas: B.B. King, Bobby Bland, Magic Sam, Albert King, Marvin Gaye, Sade.",
      "Estilos de referência: Chicago Blues, Texas Blues, Soul Blues, Rhythm & Blues.",
      "Essa combinação — blues elétrico tradicional (Chicago/Texas) cruzado com soul e R&B mais contido (Marvin Gaye, Sade) — explica o tom \"contemporâneo, não pastiche\" que já aparece em Universo Sonoro: raízes reais de blues elétrico, mas tocadas com a contenção e o acabamento de soul/R&B mais recente.",
    ],
  },
];

export function getDocBySlug(slug: string): DocPageEntry | undefined {
  return docsRegistry.find((d) => d.slug === slug);
}

export const DEFAULT_DOC_SLUG = "introducao";
