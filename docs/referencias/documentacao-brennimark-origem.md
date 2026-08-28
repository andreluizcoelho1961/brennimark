> **Documento de origem, preservado como recebido.**
>
> Chegou em 28/08/2026 com definições de identidade, produto, comercial e segurança.
> Foi filtrado no [ADR-0004](../adr/0004-o-produto-age-na-criacao.md), que registra o que foi
> incorporado e o que foi descartado, com o motivo de cada descarte.
>
> Guardado aqui inteiro porque partes ainda não incorporadas — narrativa de marca, geometria do
> monograma, modelo comercial — voltam a ser úteis quando essas decisões chegarem. Não é
> especificação vigente: onde este texto divergir dos ADRs, valem os ADRs.

---

# Documentação Oficial do Projeto: Brennimark

Este documento consolida todas as definições estratégicas, conceituais, comerciais, de interface e de segurança desenvolvidas para a plataforma **Brennimark**.

---

## 1. Identidade Conceitual e Logotipo

### Significado Histórico
*   **Nome:** Brennimark (tradução exata do islandês para "marca de fogo"). Junção de *brenni* (queimar/fogo) e *mark* (sinal/marcação).
*   **Origem Visual:** Inspirado nos antigos ferros de marcar forjados em brasa (*brennujárn*) e nos desenhos de propriedade medievais islandeses (*brennimerki*).
*   **Evolução para o Mercado de IA:** O monograma deixa de ser uma marca física de propriedade rústica para se tornar o símbolo dos algoritmos que estruturam, organizam e protegem a criatividade, conectando a ancestralidade com a precisão dos dados.

### Arquitetura do Monograma (BM)
O logotipo foi refinado para uma estética de nível global (*World-Class Brand*) baseada nas seguintes diretrizes técnicas:
*   **Mastro Compartilhado:** Uma linha vertical central única serve tanto para as costas da letra **B** quanto para a perna esquerda da letra **M**.
*   **Geometria de Linha Única (*Monoline*):** Construído com traços de espessura uniforme, garantindo reprodução impecável em telas de alta resolução e favicons microscópicos.
*   **Fusão Rúnica:** À direita do mastro, os traços retos formam duas pontas triangulares inspiradas na runa *Bjarkan* (**B**). À esquerda, as linhas simulam os eixos da runa *Mannaz* (**M**).
*   **Eliminação de Ruído:** Remoção de pontos, acentos ou runas ligadas complexas do rascunho inicial para priorizar a máxima escalabilidade e leitura industrial limpa.

### Layout e Assinatura Visual
*   **Layout Principal (Horizontal):** Símbolo à esquerda, seguido pelo nome principal "Brennimark" em destaque branco-neve, e a tagline "Branding Management" posicionada de forma limpa abaixo do nome em tom cinza-médio.
*   **Aplicação de Produto:** Alinhamento horizontal preferencial para menus e barras de navegação superiores (*SaaS header*). Alinhamento verticalizado (símbolo acima do texto) para telas de carregamento (*splash screens*), ícone de aplicativo móvel e perfis corporativos.

---

## 2. Filosofia de Design de Produto (UI/UX)

### A Interface "Moldura de Museu" (*Museum Frame*)
Como a Brennimark gerencia o ecossistema de ativos de várias marcas diferentes simultaneamente, a interface do software adota uma postura de neutralidade absoluta:
*   **Paleta Acromática:** Uso estrito de preto puro, cinzas profundos (grafite) e branco óptico. Nenhuma cor secundária de destaque (como azul tech, verde ou laranja) é adotada nos botões ou estados ativos padrão do sistema.
*   **Isolamento Cromático:** O software opera em *Dark Mode* sutil. Os gráficos, botões e barras de progresso usam estados de opacidade (ex: 100% de brilho para ativo, 40% para inativo) ou bordas finas (*strokes*).
*   **Propósito:** Esta arquitetura garante que a interface atue como um fundo passivo e elegante. O sistema nunca "briga" ou interfere visualmente com as cores, logotipos e identidades proprietárias dos clientes que estão sendo gerenciados e expostos dentro do painel.

### Níveis de Permissão por Dispositivo

1.  **Modo Estúdio (Admin/Editor):**
    *   *Dispositivos:* Otimizado para **Desktop** e **Tablets**.
    *   *Perfil:* Designers sêniores da agência, diretores de arte e gestores da marca.
    *   *Ações:* Fazer o upload do PDF original do manual de marca, compilar regras extraídas pela IA, editar blocos de texto do regulamento, calibrar os pesos das APIs e os níveis de rigor tolerados pelo motor de auditoria visual de imagens.
2.  **Modo Consulta (Visualizador/Usuário):**
    *   *Dispositivos:* Otimizado para **Mobile**, **Tablets** e **Desktop**.
    *   *Perfil:* Freelancers, agências de performance parceiras, redatores, criadores de conteúdo e equipes internas de marketing.
    *   *Ações:* Ambiente completamente blindado onde nenhuma regra estrutural do manual pode ser alterada. O usuário tem acesso exclusivamente aos utilitários de consumo: chat de consulta de regras com a IA, gerador de prompts blindados e módulo de upload de peças para auditoria e emissão de relatórios de erro.

---

## 3. Arquitetura de Telas e Responsividade

*   **Desktop (3 Colunas):** Menu esquerdo de navegação estrutural do Brandbook + Área Central de Trabalho (Editor de blocos ou painel de conformidade visual) + Painel Lateral Direito flutuante contendo a IA Assistente de conversa e prompts.
*   **Tablet (Adaptativa):** Consolida as três colunas em um sistema dinâmico onde a IA Assistente se retrai em uma gaveta oculta deslizante, otimizando o espaço da tela para o editor central de regras.
*   **Mobile (Foco em Execução):** Layout verticalizado de coluna única. A navegação pesada do Brandbook é ocultada em favor de um menu inferior (*Bottom Navigation Bar*) focado nos dois recursos essenciais de campo: o chat imediato com o assistente e o botão de upload/câmera instantâneo para escanear e auditar peças de marketing.

---

## 4. O Motor de Inteligência Artificial

O core de tecnologia da Brennimark atua em três frentes integradas no ecossistema:

1.  **O Copiloto de Criação (Brand-Aligned Prompt Builder):**
    *   *Imagens/Vídeos:* Traduz as intenções do usuário em linguagem natural em prompts técnicos blindados para motores generativos (Midjourney, Stable Diffusion, Sora). A IA injeta automaticamente os códigos hexadecimais de cor exatos da marca, restrições visuais (ex: "nunca usar iluminação dramática", "usar lente 50mm") e estilos fotográficos permitidos no guia.
    *   *Textos:* Formata os pedidos para LLMs (ChatGPT, Claude) injetando o tom de voz corporativo exato (ex: "escreva com sofisticação, use frases curtas, evite adjetivos excessivos").
2.  **O Auditor Visual (Compliance Check & Computer Vision):**
    *   O usuário realiza o upload de uma imagem ou vídeo finalizado antes de enviar para o cliente ou publicar nas redes.
    *   A IA processa o arquivo comparando-o matematicamente com as regras extraídas do manual.
    *   O sistema joga *bounding boxes* (caixas delimitadoras) avermelhadas por cima do arquivo apontando as violações em tempo real: *"Logotipo distorcido fora da proporção de segurança"*, *"Uso da tipografia Arial detectado (Substitua por Plus Jakarta Sans)"* ou *"Nível de contraste do texto inferior a 4.5:1 (Violação de acessibilidade)"*.
3.  **O Oráculo do Guia (Brand Q&A Chat):**
    *   Substitui a leitura burocrática de PDFs. Qualquer prestador de serviço pode perguntar livremente no chat: *"Qual o tamanho mínimo do logo para carimbo de Stories?"* ou *"Posso aplicar o padrão texturizado em fundo cinza?"*. A IA responde de forma corta e direta citando a seção exata da regra da empresa.

---

## 5. Estratégia Comercial e Go-To-Market (SaaS)

### Modelo de Precificação Híbrido
Para se posicionar de forma agressiva e desbancar concorrentes legados de alto custo (como Frontify e Brandfolder), o modelo de negócios separa a licença do criador do consumo da inteligência computacional:
*   **Studio Hub (Agências):** Mensalidade base baixa voltada para atrair os criadores criativos + custo fixo escalável por marca ativada. Dá acesso irrestrito ao Modo Estúdio.
*   **Brand Shield (Empresas):** Cobrança em escala baseada no volume de usuários que acessam exclusivamente o Modo Consulta ou pacotes baseados em consumo de tokens.
*   **Modelo de Créditos (Token-Based):** Cada plano possui uma cota mensal de auditorias visuais e prompts construídos. O consumo excedente funciona como expansão de receita previsível sob demanda.

### Estratégia do Cavalo de Troia (Whitelabel Parcial)
As agências de design são os maiores canais de distribuição do produto. A Brennimark permite que as agências insiram seus próprios logotipos de forma discreta na interface compartilhada com o cliente final.
*   **Impacto:** A agência vende a plataforma para o cliente como um serviço de valor agregado ("Nosso estúdio agora fornece um Brandbook Inteligente com IA 24h para sua empresa"), trazendo dezenas de marcas de clientes para dentro do ecossistema Brennimark de forma orgânica.

---

## 6. Protocolo de Segurança e Enterprise Compliance

Para obter aprovação dos setores jurídicos e de TI de marcas multinacionais e globais, a plataforma opera sob quatro regras rígidas de segurança técnica:

1.  **Isolamento de Memória Privada (Single-Tenant Context via RAG):** Os manuais de marca e dados de comportamento dos usuários de um cliente são processados exclusivamente em vetores de memória privados. **Nenhum dado, texto ou imagem corporativa de clientes da Brennimark é enviado para o treinamento público de modelos de terceiros (OpenAI, Anthropic ou Google).** O ecossistema de dados da marca A é impenetrável e invisível para a marca B.
2.  **Retenção Efêmera de Mídia (Zero Data Retention para Auditoria):** Arquivos enviados para o scanner de auditoria visual de peças publicitárias são abertos diretamente na memória RAM dos servidores criptografados e destruídos permanentemente após a emissão do relatório de erros. A plataforma não retém cópias ou bancos de dados das criações não publicadas dos clientes.
3.  **Criptografia de Nível Bancário:** Todos os ativos estáticos guardados no repositório digital final (logotipos originais vetoriais, tipografias proprietárias (.otf/.ttf), fontes e manuais consolidados) são criptografados em repouso por meio do padrão **AES-256** e protegidos em trânsito via **TLS 1.3**.
4.  **Trilha de Auditoria Transparente (Security Trail Logs):** O painel administrativo do Modo Estúdio armazena registros criptografados detalhando exatamente qual usuário ou prestador de serviço realizou uploads, quais prompts foram gerados e quais erros foram disparados, fornecendo total rastreabilidade jurídica sobre o sigilo de campanhas e vazamentos pré-lançamento.

---

## 7. Manifesto da Marca (Landing Page Copy)

### O Novo Ferro em Brasa.

Séculos atrás, nas paisagens implacáveis da Islândia, os antigos precisavam de uma forma definitiva de declarar propriedade, valor e identidade. Eles criaram o concept de **Brennimark**: a marca de fogo. Um sinal forjado no metal incandescente que desafiava o tempo, o clima e a distância para garantir que a essência de algo jamais fosse perdida ou confundida.

O tempo passou. Os ferros de marcar mudaram de lugar. Hoje, a forja não é mais de metal, mas de código. E o território a ser protegido não são mais as colinas nórdicas, mas o ecossistema digital global.

Na era da Inteligência Artificial e da criação em escala infinita, nunca foi tão fácil criar conteúdo — e nunca foi tão fácil destruir uma identidade. Marcas sofrem com a diluição crônica. Agências criam manuais de design brilhantes que morrem esquecidos em arquivos PDF estáticos de 200 páginas, enquanto colaboradores e ferramentas generativas criam peças desconectadas, sem alma, sem tom de voz e fora da paleta de cores correta.

**A Brennimark nasceu para mudar isso.**

Nós não somos um repositório de arquivos. Nós somos o **Guardião Algorítmico da sua Identidade**. Nós transformamos o manual estático da sua empresa em uma inteligência viva, discreta e onipresente.

Nós damos ao seu ecossistema criativo a liberdade absoluta para gerar imagens, textos e vídeos na velocidade da IA, mas com a garantia matemática de que nenhuma linha violará quem você é. Se estiver fora do guia, nosso robô identifica, avisa e corrige. Se houver dúvidas, nosso oráculo responde.

Unimos a ancestralidade do design linear com o futuro da automação. Protegemos o seu maior ativo contra o caos da internet.

**Brennimark. Sua marca, esculpida a fogo na era da Inteligência Artificial.**