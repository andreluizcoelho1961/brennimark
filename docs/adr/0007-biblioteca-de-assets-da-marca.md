# ADR-0007 — A biblioteca de assets da marca

- **Status:** **aceito**
- **Data:** 13/09/2026
- **Decidido por:** André, no brainstorm de 12–13/09/2026
  (`docs/brainstorm/2026-09-11-o-pdf-como-manual.md` e o registro em memória do projeto)
- **Relaciona-se com:** ADR-0002 (capacidades por marca), ADR-0003 (produto hospedado multi-marca),
  ADR-0004 (o produto age na criação), ADR-0006 (o PDF é a superfície de leitura)
- **Corrige o CLAUDE.md:** a fronteira "a plataforma não hospeda fonte licenciada de cliente algum"
  cai com este ADR (§3), e a correção entra **no mesmo commit** — o arquivo já afirmou coisa falsa
  duas vezes, e não pode afirmar uma terceira

## 1. Contexto

O manual diz a regra. O trabalho exige o **arquivo**: o logo em vetor, o ícone, a paleta, a foto.
Hoje o produto não tem onde guardá-los, e quem consulta termina pedindo o arquivo por e-mail — que é
exatamente o atrito que o produto existe para remover.

A comparação com a categoria (Frontify, Bynder, Brandfolder, Canto, MediaValet, Marq) mostrou que
esses produtos são, no núcleo, **gerenciadores de arquivo** com uma camada de manual em cima. Grid,
filtro, ação em lote e coleção são mesa posta. **É a única ausência que hoje tira o Brennimark da
comparação** — não a escolha do PDF, que é diferencial de tempo até estar no ar.

Princípio que atravessa tudo: **a plataforma não fabrica nem converte arquivo de marca. Ela
distribui o que o assinante subiu.**

## 2. Decisão

Existe uma **biblioteca de assets por marca**, com página própria.

### 2.1 Dois regimes, porque os acervos são diferentes

| Regime | Tipos | Como se organiza |
|---|---|---|
| **Estruturado** | logo, ícone, paleta, fonte, gabarito | eixos fixos, vocabulário fechado |
| **Acervo livre** | foto, ilustração | **pastas criadas pelo assinante**, miniatura, navegação visual |

O segundo regime é decisão de ofício: não dá para prever que tipos de foto uma marca terá —
funcionário, produto, evento, bastidor. Impor taxonomia fixa a fotos seria inventar requisito.

### 2.2 Regime estruturado

1. **O asset pertence à marca**, não à página do manual. A página que apresenta o logo traz um
   atalho para a biblioteca.
2. **Item não é arquivo.** Um item ("Logo") reúne variantes e formatos. A interface é matriz, nunca
   lista plana.
3. **Eixos do logo, cada um um campo próprio:** hierarquia (principal, secundário); lockup
   (horizontal, vertical); cor (colorido, monocromático); polaridade (positivo, negativo).
4. **Espaço de cor é campo explícito: RGB ou CMYK.** Não se deduz do formato — `logo.eps` não diz
   qual é, e PDF e AI carregam os dois. Deduzir erraria justamente no arquivo que a gráfica usa.
5. **Os atributos variam por tipo:** paleta e gabarito não têm polaridade nem lockup.

### 2.3 Acervo livre (foto e ilustração)

6. **Página de navegação visual, com miniatura.** Quem procura foto procura com os olhos.
7. **Pastas criadas pelo assinante**, livres.
8. **Download de uma por vez ou de várias selecionadas.**

### 2.4 Regras comuns

9. **Quem sobe é o assinante**, pela capacidade de edição. Quem consulta lê e baixa. Quais arquivos
   existem é **curadoria do assinante**, não regra do produto.
10. **Substituir não apaga.** A versão anterior fica **descontinuada**, visível e identificada.
    Nunca apagar, reescrever ou normalizar asset em silêncio (CLAUDE.md).
11. **Download em pacote, por conjunto:** o pacote de logos, o de ícones, a seleção de fotos. O ZIP
    é montado **no navegador**, a partir de endereços assinados. Sem função montando e sem ZIP
    guardado — não há segunda cópia da verdade para envelhecer.
12. **O arquivo avulso continua existindo** onde o contexto é específico.
13. **Sem conversão de formato.** Baixa-se o que foi subido. **Exceção declarada:** miniatura de
    exibição não é conversão de entrega — ver §4.
14. **Download com a regra colada.** Ao baixar uma variante, o produto mostra a regra que a governa,
    com a página do manual e link para ela. Nenhum concorrente faz isso, porque neles o arquivo e o
    manual são camadas que se ignoram; aqui vivem no mesmo produto, ligados por página.
15. **A regra é conta e convite.** Alcançar a marca, o manual ou o acervo exige entrar, e entrar
    exige conta e convite.
16. **A exceção é a entrega governada: link com prazo** — ver §2.5.
17. **Paleta** pode ser gerada dos hex já extraídos (`.ase`, `.css`, `.json`) **e** aceitar o que o
    assinante subir.
18. **Registro de download** — o quê, quando, por quem — visível ao assinante.

### 2.5 Entrega governada: o link com prazo

Existe um link que entrega arquivos a quem **não tem conta**: a gráfica contratada para um job de
duas semanas, o fornecedor pontual.

**O motivo não é a concorrência.** Sem ele, o atrito não impede o compartilhamento: empurra-o para
fora da plataforma. O arquivo sai por WhatsApp ou WeTransfer, **sem registro** de quem recebeu, **sem
prazo**, **sem a regra** que governa o uso e possivelmente **desatualizado**. O produto perde o
controle exatamente do tráfego que existe para governar, e no caso em que o destinatário é o menos
treinado de todos.

Inversão que vale registrar: **para uso pontual, o link é MAIS seguro que o convite.** O link expira
sozinho; a conta convidada depende de alguém lembrar de remover.

Limites que o mantêm coerente com "conta e convite é a regra":

- escopo de **uma seleção**, nunca da marca, do manual ou do acervo inteiro;
- **prazo obrigatório**, com expiração automática;
- **token**, não endereço adivinhável;
- **cada acesso registrado** — quem abriu, quando, o que baixou;
- **revogável** pelo assinante a qualquer momento;
- **só download.** Nunca upload, nunca navegação pelo acervo, nunca o manual inteiro;
- **carrega a regra junto** (item 14), e a condição de licença quando houver fonte.

#### 2.5.1 Como o token autoriza — decisão de desenho

O link autoriza por **token**, e não por participação na conta. São **dois caminhos de autorização**,
e ambos nascem na primeira migration da biblioteca: acrescentar o segundo depois significaria refazer
a autorização do acervo.

**A RLS continua falando só de participação.** O caminho anônimo é atendido por uma **rota de
servidor** que valida o token, confere prazo e revogação, registra o acesso e devolve endereços
assinados de curta duração.

A alternativa — ensinar a RLS a aceitar token como credencial — foi recusada: política que aceita
dois tipos de credencial é política que alguém lê errado depois, e o erro aqui vaza arquivo de
cliente. Com a rota, a autorização anônima fica explícita num lugar só, auditável.

O token é guardado como **hash**, nunca em claro: quem lê a tabela não ganha o poder de abrir o link.

## 3. Fonte: a plataforma passa a hospedar

Cada marca tem a sua fonte hospedada. Ao contratar, o assinante assina um termo declarando que a
responsabilidade pela licença de uso é dele, como dono ou representante da marca.

⚠️ **Isto reverte uma fronteira escrita do CLAUDE.md**, corrigida no mesmo commit deste ADR. O que a
reversão obriga, e sem o que ela não se sustenta:

1. **O termo tem de existir de fato, assinado, ANTES de a hospedagem ser ligada.** Responsabilidade
   não se transfere por intenção: sem texto assinado, ela continua com quem serve o arquivo.
2. **Aceite registrado no upload**, com autor e data.
3. **Procedimento de retirada:** se uma foundry notificar, é preciso saber remover e avisar.
4. **A fonte é servida só para download, a membro autenticado daquela marca** — nunca por URL
   pública, nunca como webfont de renderização, sem hotlink e sem CDN. O registro de download é o
   que responde a uma foundry que pergunte quem recebeu o arquivo.

**Por que não há alternativa:** não existe a opção de não baixar a fonte. Quem trabalha na marca
baixa o logo e tudo mais; se a fonte fica de fora, o texto renderiza errado no primeiro arquivo
aberto, e a plataforma fica inútil no momento em que mais deveria servir.

### 3.1 Dimensionando o risco

| Categoria | Situação |
|---|---|
| **Livre** (Google Fonts, SIL OFL) | redistribuição permitida; risco zero |
| **Exclusiva, desenhada para a marca** | a marca é **dona** e distribui a quem quiser |
| **Comprada de foundry** | a licença costuma permitir uso por fornecedores do licenciado, às vezes exigindo licença própria de cada um. É a única que pede cuidado |

### 3.2 O que o termo faz, e o que não faz

- **Vale entre a plataforma e o assinante, e não vincula a foundry**, que é terceiro. Ele não impede
  uma notificação; define **quem responde** por ela.
- **A declaração se repete no upload**, não só na assinatura do plano: quem sobe a fonte da marca X
  pode não ser quem assinou o contrato.

### 3.3 A licença vira informação do produto

Campo no item fonte — **tipo de licença, titular e como obter** — exibido **no momento do download**,
no mesmo lugar em que a regra aparece colada ao logo. Se a fonte exigir licença própria de cada
fornecedor, o produto diz isso na hora de baixar, com o contato.

## 4. A miniatura

A proibição de conversão (item 13) é sobre **entrega**. A miniatura é prévia, e serve só para o
designer decidir qual arquivo vai baixar.

**Gerada no navegador de quem SOBE**, junto com o upload: o original e a miniatura sobem juntos.
Nenhum trabalho de servidor, nenhuma fila, nenhum pipeline a manter — e a afirmação "a plataforma não
converte arquivo de marca" continua literalmente verdadeira no servidor.

A alternativa recusada é o navegador de quem CONSULTA encolher o original: uma página com 60 fotos
baixaria 60 originais para mostrar 60 quadradinhos.

Consequência honesta: **JPG e PNG geram miniatura sem dificuldade; AI e EPS, não** — são PostScript,
e nem servidor nem navegador os abrem sem Ghostscript. Vetor entra sem prévia, a menos que o
assinante suba uma versão de visualização, e **o produto diz isso** em vez de mostrar um quadro
cinza. SVG é a exceção fácil: o navegador desenha nativamente.

## 5. Condição de segurança — não publicar sem ela

⚠️ Hoje a autorização resolve **por conta, não por marca**: `workspace_members` tem apenas
`(workspace_id, user_id, role)`, `role` só aceita `owner` e `member`, e a RLS de `brands` libera
SELECT a qualquer membro da conta. Verificado no código em 12/09/2026.

Enquanto o produto expõe só **nomes** de marca, o dano é informação comercial. **Com a biblioteca no
ar, o mesmo furo passa a vazar ARQUIVO**: um fornecedor convidado para uma marca baixa o vetor de
outra — inclusive de um rebrand não anunciado, e agora também a fonte licenciada.

> **Condição:** a biblioteca só entra em produção junto com **acesso por marca**, e portanto com a
> separação de `editar` e `aprovar`.

**O modelo, decidido por André em 13/09:** uma tabela de acesso **por marca** guardando
**capacidades** (`consultar`, `editar`, `aprovar`, `administrar`) — o vocabulário que o ADR-0002 já
definia e que nunca existiu no banco. A conta continua dizendo quem pertence a ela; a marca passa a
dizer o que cada um pode.

**A migração preserva o acesso de hoje:** todo `owner` recebe as quatro capacidades em todas as
marcas da sua conta, e todo `member` recebe `consultar`. Ninguém perde acesso no dia da migração; a
restrição passa a valer quando alguém for convidado para **uma** marca.

Recusadas: manter o papel por conta com exceções por marca (duas fontes de verdade para
autorização), e papéis fixos por marca (contraria a escolha de capacidades do ADR-0002).

## 6. O que fica de fora, de propósito

- **Pacote por audiência e preset por destino.** Chegaram a ser aprovados no brainstorm e foram
  revertidos: baixa-se o pacote de logos, o de ícones, e pronto.
- **Conversão de formato na entrega.**
- **Etiquetagem automática por IA.** Existe em todos os concorrentes, não é o gargalo.
- **Molde travado para produção de peça** (a camada do Marq). Sem decisão, e muda o que o produto é.

## 7. Banco

**Verificado em 13/09, antes de modelar:** `brand_assets` **já existe** —
`(id, workspace_id, brand_id, label, description, category, storage_path, file_name, mime_type,
size_bytes, status, created_by, created_at, updated_at)` — com quatro policies (membro lê, owner
escreve) e oito arquivos de código a usando, entre eles o importador.

Ela é **uma linha por arquivo**, sem agrupamento item↔variante, sem os eixos, sem espaço de cor e sem
pastas. **Decisão: estender, não substituir.** `brand_assets` continua sendo a tabela do arquivo, e
os eixos e o vínculo com o item entram como colunas e como tabela nova por cima. Substituir exigiria
migrar dado e mexer nos oito arquivos por nenhum ganho.

Exigências do projeto, sem exceção: migration versionada, RLS, índices e **teste de autorização
negativo** — provar que a conta A não lê os assets da B, **e** que a marca X não lê os da Y.
Condição 2 do ADR-0003.

## 8. Consequências

**Ganhos.** Fecha a ausência que tira o produto da comparação; o fornecedor resolve sozinho o que
hoje vira e-mail; o registro de download dá ao assinante informação que ele não tem; e a regra colada
ao arquivo é diferencial que a concorrência não alcança por arquitetura.

**Perdas e custos, ditos por inteiro:**

- **A catalogação recai sobre o assinante.** Campo obrigatório no upload é o que mantém o metadado
  limpo, e isso é atrito no dia da importação.
- **Sem conversão, quem não subiu CMYK não tem CMYK.** O produto diz isso em vez de fingir.
- **Vetor sem miniatura** (§4).
- **O ZIP no navegador é montado em memória.** Para vetores e PNG sobra folga; um kit acima de
  ~100 MB sofre. **Medir com um kit real** antes de assumir o plano B, que é montar no servidor.
- **Espaço.** O plano atual tem 1 GB no total, dividido com os PDFs. Acervo de fotos é o que mais
  cresce num DAM, e provavelmente força a migração para o Pro.
- **Responsabilidade sobre fonte licenciada** passa a existir como risco operacional, mitigado pelo
  termo, pelo aceite e pelo registro de download — nunca eliminado.

### 8.1 Cota por plano: medir agora, cobrar depois

Por enquanto usa-se o espaço do plano atual. Quando o produto for comercializado, cada plano declara
quanto oferece.

⚠️ **A consequência técnica não é o preço, é a MEDIÇÃO.** O ADR-0004 §3.4 já registrou o princípio
para consumo de IA: instrumentar desde a primeira operação.

- **Construir agora:** o consumo em bytes **por conta e por marca**, somando PDF, assets e
  miniaturas. É barato enquanto o dado é novo, e não há como reconstituir depois o que uma conta
  consumia no mês passado.
- **NÃO construir agora:** limite, bloqueio, plano, cobrança.

**Um terceiro teto aparece.** O CLAUDE.md distingue o teto do PRODUTO (100 MiB) do teto da
INSTALAÇÃO (50 MB), ambos **por arquivo**. A biblioteca acrescenta o **espaço acumulado da conta**,
que falha por outro motivo: não é o arquivo que é grande, é a conta que está cheia. A recusa precisa
dizer qual dos três barrou — são problemas com soluções diferentes.

## 9. Reversibilidade

⚠️ **Cara.** É modelo de dados com arquivos de clientes dentro: mudar a taxonomia depois exige migrar
dado real. É por isso que os eixos nascem como **campos separados** desde o começo.

A hospedagem de fonte é ainda menos reversível na prática: depois que fornecedores baixaram a fonte
de uma marca, desfazer a decisão não recolhe o que já saiu.

O que é barato: a interface, o ZIP no navegador (troca por servidor sem mexer em dado) e a regra
colada.

## 10. Verificação

- `npm run verify` completo, **sem pipe** — o pipe devolve o código de saída do `tail`.
- Teste de autorização negativo por conta **e** por marca.
- Teste de navegador: subir, listar, baixar avulso, baixar o pacote, navegar nas pastas de fotos, e
  o link com prazo — inclusive **depois de expirado e depois de revogado**.
- Medição do ZIP com um kit real antes de declarar o limite aceitável.
- Conferência em produção, com o mesmo rigor dos Marcos A e B.
