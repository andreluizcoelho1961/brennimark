> **Documento histórico — não é especificação vigente.**
>
> Descreve a matriz de instalações isoladas — uma marca por deploy, banco e domínio próprios. Substituído pelo [ADR-0003](./adr/0003-produto-hospedado-multi-marca.md), que adota
> produto hospedado multi-marca com silo como plano superior, e pelo
> [ADR-0004](./adr/0004-o-produto-age-na-criacao.md).
>
> Preservado porque o raciocínio continua útil e porque a opção de silo permanece disponível como
> plano. Onde este texto divergir dos ADRs, valem os ADRs.

---

# Matriz replicável do Brandville

## Decisão de produto

Cada Brandville continua sendo uma instalação individual: um domínio, uma marca,
um conjunto de usuários, um banco e uma configuração de IA. Esta matriz não
transforma o produto em uma plataforma onde clientes diferentes dividem a mesma
interface ou o mesmo banco.

O objetivo é repetir a implantação sem repetir a engenharia.

## O contrato de uma instância

`src/brandville/types.ts` define tudo que a interface precisa saber:

- identidade e metadados da marca;
- grupos, códigos e página inicial da navegação;
- páginas do guide e estado editorial de cada uma;
- tema visual e stack tipográfica;
- identidade do assistente e modo de conhecimento;
- recursos disponíveis e aviso de uso.

`src/brandville/config.ts` resolve a instância ativa por meio da variável
`NEXT_PUBLIC_BRANDVILLE_INSTANCE`. Componentes, prompts, relatórios e metadados
consomem essa configuração central.

## Instâncias incluídas

- `the-bluesmaker`: instalação real e padrão.
- `example`: Empresa X, usada somente para provar e testar a replicação.

## Como iniciar um novo cliente

O onboarding interno do estúdio elimina a duplicação e o registro manual. Há duas
formas de iniciar:

```bash
# questionário guiado
npm run brandville:new

# manifesto preenchido durante o projeto
npm run brandville:new -- --input brandville/cliente.json
```

O modelo completo está em `brandville/intake.example.json`. Antes de gerar, é
possível validar ou simular sem alterar arquivos:

```bash
npm run brandville:new -- --input brandville/cliente.json --check
npm run brandville:new -- --input brandville/cliente.json --dry-run
```

O gerador valida slugs, grupos, códigos, páginas, estados editoriais, recursos,
cores e contraste. Quando tudo está correto, ele cria:

- a configuração tipada da instância;
- uma cópia do manifesto usado;
- o registro automático na matriz;
- a pasta pública de assets;
- o checklist individual de lançamento.

Depois disso, defina `NEXT_PUBLIC_BRANDVILLE_INSTANCE=<slug>` no projeto do
cliente, use Supabase e Vercel exclusivos, configure domínio, usuários e IA e
rode lint, testes, build e revisão visual antes da publicação.

## Importar um brand book existente

O importador transforma a camada textual de um PDF em um primeiro manifesto
editorial, sem publicar nada automaticamente:

```bash
npm run brandville:import -- \
  --pdf /caminho/manual-da-marca.pdf \
  --brand "Nome da Empresa" \
  --key nome-da-empresa \
  --descriptor "Descrição curta"
```

Ele preserva as páginas de origem, usa hierarquia tipográfica para propor
seções, classifica grupos prováveis e marca todas as páginas como rascunho. A
saída contém o manifesto e um relatório de revisão. Depois da curadoria:

```bash
npm run brandville:new -- --input brandville/imports/nome-da-empresa.json --check
```

PDFs sem camada de texto são interrompidos com uma indicação explícita de OCR
ou análise visual. Cores, imagens, exemplos e relações espaciais nunca são
convertidos em regras somente pela extração textual.

### Curadoria antes da geração

Importações reais devem passar por uma camada explícita de curadoria. Ela pode
remover divisórias, corrigir títulos e grupos, aplicar tokens confirmados e
registrar decisões pendentes sem alterar o PDF de origem:

```bash
npm run brandville:curate -- \
  --input brandville/imports/cliente.json \
  --rules brandville/imports/cliente-curation.json \
  --output brandville/imports/cliente.curated.json
```

Referências renderizadas podem ser relacionadas às páginas curadas com
`npm run brandville:references`. Esses arquivos servem para conferência; logos
vetoriais, fontes licenciadas, fotografias originais e templates de produção
continuam sendo assets obrigatórios da implantação final.

## Conteúdo e estados

Cada página usa `ready`, `draft` ou `pending`. O assistente recebe esses estados
e não deve apresentar decisões provisórias como regras definitivas. Páginas
genéricas precisam apenas de título, grupo, texto e imagens. Componentes visuais
especializados podem ser adicionados ao mapa de slugs quando um projeto exigir.

No modo de IA `docs`, somente as páginas da instância alimentam o assistente. O
modo `full` acrescenta as estruturas especializadas já existentes no projeto do
The BluesMaker. Novos clientes devem começar em `docs` e só migrar para `full`
quando seus módulos estruturados tiverem sido modelados e testados.

## Isolamento obrigatório

Nunca reutilizar entre clientes:

- banco de dados ou bucket de evidências;
- chaves de IA e chave de criptografia;
- domínio, cookies ou usuários;
- arquivos licenciados, especialmente fontes;
- assets privados e histórico de análises.

## Administração sem código

Depois de publicada, cada instância mantém sua própria área em `/docs/admin`.
Somente o proprietário do workspace pode acessá-la. O editor permite alterar
título, seção, status e texto das páginas, além de administrar a biblioteca
privada de assets. As alterações ficam no Supabase e sobrepõem a matriz base;
"Restaurar matriz" remove a sobreposição e recupera imediatamente o conteúdo
versionado no projeto.

O guia e os prompts do assistente usam a mesma versão resolvida do conteúdo.
Assim, uma página salva no editor passa a orientar também o chat e a análise
de aplicações, sem necessidade de um novo deploy.

Cada mudança gera automaticamente uma entrada imutável em
`brand_document_versions`. A linha do tempo fica dentro do próprio editor e
permite recuperar versões anteriores. Recuperar não apaga o estado atual: a
operação publica uma nova versão e mantém todo o histórico precedente.

## Critério de pronto para entrega

- nenhuma referência indevida a outra marca;
- todas as páginas pertencem a um grupo navegável;
- códigos de grupo são únicos e curtos;
- página inicial existe;
- contraste e responsividade revisados;
- assistente responde apenas com fontes da instância;
- análise, histórico, feedback e PDF testados;
- variáveis de produção e backups documentados;
- aprovação final do conteúdo pelo cliente.
