# Estado do produto — 30/08/2026

> **Continuação em `handoff-auditoria-2026-09-01.md`.** A auditoria de 01/09
> encontrou defeitos de segurança e escala; o handoff registra o que já foi
> corrigido, o baseline novo (205 unidades / 81 navegador) e o que falta.

Escrito para que qualquer pessoa (ou eu, na próxima sessão) retome sem
reconstruir contexto. O que está provado, o que não está, e o que falta fazer.

---

## O que o Brennimark é

Plataforma de gestão de manuais de marca, vendida a agências e estúdios. Uma
conta (workspace) contém marcas; cada marca tem seu manual, sua paleta, seu
vocabulário editorial e suas funcionalidades contratadas.

A regra que atravessa tudo: **a marca é o conteúdo, o Brennimark é o sistema**.
A moldura do produto é acromática e constante; o canvas veste a marca. Nenhum
token atravessa entre as duas camadas, e há teste de pixel medido provando isso
com quatro marcas opostas.

---

## Onde as coisas estão

| | |
|---|---|
| Repositório | `~/meus-projetos/Brennimark` · `github.com/andreluizcoelho1961/brennimark` (privado) |
| Supabase | projeto `brennimark`, ref `ijnpigdmlswhkxqbjeru`, região sa-east-1 |
| Produção | `https://brennimark.vercel.app` — projeto Vercel `brennimark`, deploy em 30/08 |
| Ambiente local | `.env.local` (fora do git) com URL, chave publicável e uma chave de cifra gerada localmente |
| Servidor | `npm --prefix ~/meus-projetos/Brennimark run dev` — porta 3000 |
| Testes | `npm run verify` = lint, tipos, **204** unidades, build, 71 de navegador |

> **Números anteriores a 01/09 não valem.** A suíte listava os arquivos de
> teste um a um e `lib/import` nunca entrou na lista: `draft.test.ts` existia e
> nunca executava. O baseline correto foi estabelecido com `npm ci` limpo.

**Configuração de autenticação (Supabase → Authentication → URL Configuration):**
o *Site URL* e a lista de *Redirect URLs* precisam conter o domínio de produção,
senão o link de confirmação do cadastro aponta para `localhost` e o e-mail vira
um beco sem saída. Valores:

- Site URL: `https://brennimark.vercel.app`
- Redirect URLs: `https://brennimark.vercel.app/**` e `http://localhost:3000/**`

É a única peça do ciclo que não está no código nem em migração — mora no painel.

**Atenção ao rodar local:** o Next recusa duas instâncias no mesmo diretório.
Com o servidor de desenvolvimento no ar, `npm run verify` falha ao subir o
servidor do Playwright. Pare um antes de rodar o outro. Não afeta o CI.

---

## O que está provado

**Banco.** Isolamento entre contas por chave estrangeira composta, não só por
RLS — um documento da conta A não consegue apontar para uma marca da conta B, e
a linha simplesmente não pode existir. Cascata de exclusão testada com o ciclo
documentos ↔ versões. Vocabulário de ações do histórico dizendo o que aconteceu.

**Autorização.** Testada com `set local role authenticated`, não como
`postgres`. Essa distinção derrubou um P0: um teste de autorização que roda
como superusuário não testa autorização.

**Interface.** Moldura idêntica em quatro marcas opostas; nenhum token de marca
no documento; sem transbordo em 320/375/390/768/1024/1440; gaveta com foco
preso, Escape, véu, `inert` no resto da aplicação, e devolução de foco em
quatro caminhos distintos.

**Separação de idioma.** O idioma da interface é do produto e de quem usa; o do
manual é da marca. Duas exceções deliberadas e testadas: o selo de status e o
prompt do assistente.

**Importador.** Prévia sem escrita, tudo nasce rascunho, publicação atômica por
RPC `security invoker`, procedência que exige arquivo existente, objeto
imutável e exclusivo por importação, fila durável de exclusão.

---

## O que NÃO está provado

**O ciclo autenticado real.** Nenhum usuário existe no projeto. Isso deixa em
aberto, todas juntas:

1. o upload cria objeto visível à política de Storage;
2. a RPC enxerga esse objeto;
3. a política de `brand_imports` também enxerga;
4. o registro persistido aponta para o caminho certo;
5. a exclusão remove o objeto;
6. uma segunda exclusão, ou objeto já ausente, encerra a fila.

E, dependentes disso: o manual vestido pela marca nas rotas reais, a navegação
por dentro da gaveta entre rotas filhas, e o assistente consultando só a marca
importada.

O caso positivo do Storage **não é simulável em SQL**: criar o objeto exige a
API do Storage, e escrever direto em `storage.objects` produziria metadado sem
arquivo — exatamente a mentira que a política existe para impedir.

---

## O protocolo do primeiro ciclo

Os passos 1 e 2 são de quem opera; eu não crio conta nem autentico.

1. Criar conta em `/login` → aba **Criar conta** → confirmar o e-mail.
2. Completar o onboarding (nome).
3. `/docs/importar` → escolher PDF → conferir a prévia → nome, idioma do manual,
   funcionalidades → publicar.

Verificações que eu executo depois:

| # | O que confirmar |
|---|---|
| 3 | caminho no Storage é `conta/importação/hash.pdf` |
| 4 | 1 marca, 1 registro de importação, documentos **só rascunho** |
| 5 | manual abre com conteúdo, idioma e identidade corretos |
| 6 | repetir a tentativa não duplica |
| 7 | excluir remove marca, documentos, versões, procedência, PDF; fila zerada |
| 8 | repetir a exclusão dá sucesso idempotente |
| 9 | pendência simulada é drenada ao abrir a administração |

Encerrar com capturas desktop e mobile e um relatório curto com identificadores
e contagens antes/depois — sem token e sem conteúdo sensível do PDF.

**Estado do banco antes do ciclo:** zero em tudo — usuários, workspaces, marcas,
documentos, versões, importações, pendências, arquivos.

---

## Dívidas registradas

- **`ai-settings` cai em `consultar`** — ver `divida-capacidade-ai-settings.md`.
  Bloqueia convidar o primeiro membro, não o importador.
- **Patch 6:** ~340 ocorrências de `release-analog-*` fora da moldura. Adiado de
  propósito: fazê-las antes do importador deixaria a avaliação visual apoiada em
  estado vazio e fixtures.
- **Migração 2:** a marca ativa ainda é filtrada por
  `NEXT_PUBLIC_BRENNIMARK_INSTANCE`. Documentado como compatibilidade
  temporária; sai quando houver seleção de marca em tempo de execução.
- **Preferência de idioma por pessoa:** não existe onde guardar. O
  desacoplamento do manual está feito; a personalização exige coluna, mudança em
  `resolveInterfaceLocale` e nos módulos que leem `PRODUCT_LOCALE` direto.
- **Imagens do PDF** não são extraídas. Referência de revisão nunca vira asset
  oficial; assets entram pela biblioteca.

---

## Como esta revisão funcionou, e por que importa

Cada patch passou por revisão externa que encontrou defeitos reais **depois** do
CI verde. O padrão dos achados vale registrar, porque ele se repetiu:

- **quase nenhum era erro de lógica dentro de um componente.** Eram cruzamentos:
  instrumento × instrumento, estado × largura, foco × visibilidade, correção ×
  montagem;
- **vários passaram porque o teste passava por fora do caminho real** — contexto
  do prompt montado à mão, autorização testada como superusuário, foco chamado
  pelo próprio teste antes de verificar;
- **toda proteção precisa ser provada capaz de falhar.** Duas sondas minhas
  foram inócuas (código de servidor que nunca roda no cliente; classe CSS
  trocada sem remover a que vencia) e não valiam como prova.

A prática que sobrou: para cada correção, injetar a regressão e confirmar que o
teste certo — e só ele — fica vermelho.
