# Briefing para o CODE — integração crítica e implantação da nova interface do Brennimark

## 1. Objetivo desta etapa

Transformar o que hoje é uma combinação de arquitetura nova, interface antiga e protótipo paralelo em um único produto coerente.

Ao final desta etapa:

- a marca ativa no banco deve ser a única fonte de identidade, conteúdo, tema e configuração da marca cliente;
- a moldura V2 deve ser a interface real do aplicativo, não uma rota de laboratório;
- desktop e mobile devem funcionar como composições próprias e completas;
- a moldura do Brennimark deve permanecer visualmente independente da marca cliente;
- componentes de plataforma não podem usar tokens herdados de Hairline, Bootstrap ou `release-analog`;
- a arquitetura deve estar pronta para receber a identidade visual definitiva do Brennimark, sem que o CODE invente essa identidade nesta fatia.

Este não é um pedido para “dar uma arredondada” na interface existente. É uma troca de fundação e de composição.

---

## 2. Contexto e diagnóstico confirmado

### 2.1 Estado verificado

Revisão realizada sobre o commit:

`a966323 — Migração 1, PR 2: a leitura vem do banco`

Baseline confirmado:

- lint: verde;
- typecheck: verde;
- 74 testes: verdes;
- build de produção: verde;
- CI do GitHub: verde.

O fato de o CI estar verde não significa que a integração esteja correta. Os problemas abaixo são lacunas de arquitetura, produto, responsividade e cobertura de testes.

### 2.2 O que melhorou

- Os arquivos e conteúdos específicos da Hairline foram removidos em grande escala.
- Os namespaces `--platform-*` e `--brand-*` são uma boa fundação.
- O selo editorial deixou de vestir a cor da marca cliente.
- A tradução das linhas de `brands` e `brand_documents` foi isolada em funções puras e testáveis.
- A busca da V2 considera o conteúdo das páginas.
- A moldura V2 apresenta uma composição desktop mais clara que a V1.

### 2.3 O que ainda está inconsistente

Há três gerações coexistindo:

1. a interface antiga em `/docs`, baseada em `DocsNav` e nos aliases visuais legados;
2. a moldura V2 em `/dev/shell-v2`, bloqueada em produção;
3. a nova leitura por `brand_id`, enquanto tema, idioma, navegação, administração e histórico continuam parcialmente ligados à instância estática e a `instance_key`.

Essa coexistência precisa terminar.

---

## 3. Princípios inegociáveis

### 3.1 A marca é o conteúdo; o Brennimark é o sistema

- A marca cliente pode controlar o canvas editorial.
- A marca cliente não controla navegação global, sessão, busca, status, administração, mensagens de erro ou outros instrumentos do sistema.
- O usuário deve reconhecer que está dentro do Brennimark sem que o Brennimark dispute atenção com a marca apresentada.

### 3.2 Uma única fonte de verdade por responsabilidade

- Dados da marca ativa: banco, resolvidos por requisição e por contexto de usuário/workspace.
- Dados do produto Brennimark: módulo da plataforma.
- Preferência de idioma da interface: usuário ou configuração da plataforma; nunca inferida automaticamente do idioma do manual da marca.
- Estado editorial e permissões: plataforma, com autorização no servidor.

### 3.3 Não manter duas interfaces em produção

Depois da migração e da verificação de paridade, `DocsNav` não pode continuar como segunda implementação concorrente.

### 3.4 Não criar a identidade definitiva por improviso

Nesta etapa, não inventar:

- logotipo final;
- símbolo;
- tipografia proprietária;
- cor principal definitiva;
- grafismos de marca.

A moldura deve usar os tokens provisórios existentes, mas toda a arquitetura deve permitir trocar esses valores em um único lugar quando a identidade for aprovada.

### 3.5 Referência, não cópia

Usar como referência de qualidade e repertório de produto:

- Refero Web Apps: <https://refero.design/web-apps>

Observar especialmente hierarquia, densidade, busca, navegação, estados vazios, configurações, administração, responsividade e refinamento de controles. Não copiar uma interface específica nem montar um mosaico de tendências.

---

## 4. Bloqueadores encontrados

### P1 — A existência da marca ainda é decidida por estado estático

Arquivos envolvidos:

- `src/app/docs/page.tsx`
- `src/brandville/config.ts`
- `src/lib/brandville/server.ts`

Problema:

`/docs` usa `hasBrand`, calculado a partir de `brandvilleInstance`. Uma marca pode existir em `brands` e a interface continuar mostrando “Nenhuma marca por aqui ainda”.

Correção necessária:

- resolver a marca ativa no servidor;
- usar o resultado real para decidir entre estado vazio e manual;
- redirecionar para o `defaultDocSlug` da marca ativa do banco;
- ausência de marca deve ser `null`, não uma falsa instância global usada como fonte de comportamento.

### P1 — Conteúdo novo com tema e identidade antigos

Arquivos envolvidos:

- `src/components/BrandCanvas.tsx`
- `src/components/shell/WorkspaceIdentity.tsx`
- `src/app/layout.tsx`
- `src/brandville/config.ts`

Problema:

Os documentos podem vir da marca no banco, mas o canvas, nome, descriptor, idioma e metadados continuam derivados da instância estática.

Correção necessária:

- `BrandCanvas` deve receber explicitamente o tema da marca ativa;
- `WorkspaceIdentity` deve receber nome e descriptor como propriedades;
- componentes não devem importar uma marca global para descobrir o contexto atual;
- metadados do produto e idioma da interface devem ser separados dos metadados do manual;
- nenhum componente de plataforma deve depender de `brandvilleInstance.metadata.language`.

### P1 — A administração grava em um modelo que a leitura nova não consulta

Arquivos envolvidos:

- `src/app/api/admin/content/route.ts`
- `src/app/api/admin/content/history/route.ts`
- `src/app/docs/admin/page.tsx`
- migrações de `brand_documents` e `brand_document_versions`

Problema:

A leitura usa `brand_id`. A administração ainda:

- valida o slug contra `activeDocsRegistry`;
- usa grupos da instância estática;
- grava e consulta por `workspace_id + instance_key`;
- não preenche `brand_id`;
- trata o registro em código como matriz restaurável.

Correção necessária:

- toda escrita deve resolver a marca ativa autorizada;
- toda consulta e mutação deve usar `brand_id`;
- validar que o documento pertence à marca ativa e ao workspace autorizado;
- atualizar histórico e restauração para o mesmo vínculo;
- decidir explicitamente o significado de “restaurar”: versão anterior do banco, não retorno a uma matriz em código que deixou de existir;
- migrar esquema e dados de forma aditiva e revisável; não apagar colunas ou registros sem uma etapa própria e validação.

### P1 — A V2 não está na rota do produto

Arquivos envolvidos:

- `src/app/docs/layout.tsx`
- `src/app/dev/shell-v2/[[...slug]]/page.tsx`
- `src/components/docs/DocsNav.tsx`
- `src/components/shell/AppShellV2.tsx`

Problema:

`/docs` continua montando `DocsNav`. A V2 existe apenas em uma rota de laboratório fechada em produção.

Correção necessária:

- completar a paridade funcional da V2;
- integrar a V2 ao layout real de `/docs`;
- manter a rota de comparação apenas enquanto ela for útil para validação;
- depois da aprovação e da verificação, remover `DocsNav` e seus fluxos duplicados.

### P1 — A V2 quebra no mobile

Arquivos envolvidos:

- `src/components/shell/AppShellV2.tsx`
- `src/components/shell/DesktopSidebar.tsx`
- `src/components/shell/PlatformTopBar.tsx`
- `src/components/shell/navigation.ts`

Problema reproduzido em 390 × 844 px:

- sidebar fixa de 224 px;
- apenas 166 px restantes para o conteúdo;
- busca de 224 px ultrapassando a topbar;
- conteúdo transformado em uma coluna estreita e excessivamente longa;
- ausência de navegação mobile própria.

Correção necessária:

- a sidebar desktop não pode existir abaixo do breakpoint definido;
- criar topbar mobile com identidade compacta, busca e abertura de navegação;
- usar drawer ou sheet para a navegação completa;
- considerar uma navegação inferior somente para os destinos de maior frequência marcados com `mobile: true`;
- preservar o canvas como região dominante;
- garantir alvos de toque de no mínimo 44 × 44 px;
- impedir overflow horizontal em todos os breakpoints.

### P2 — A herança visual permanece ativa

Estado medido em `src`:

- 340 ocorrências de `release-analog`;
- 26 arquivos com `release-analog`;
- 136 ocorrências de `font-display`.

Arquivos centrais:

- `src/app/globals.css`
- `src/platform/tokens.ts`
- componentes de administração, ativos, IA, análise e documentos.

Correção necessária:

- classificar cada componente como plataforma, canvas da marca ou conteúdo híbrido com boundary explícito;
- migrar componentes de plataforma para `platform-*`;
- migrar conteúdo editorial da marca para `brand-*`;
- usar `PlatformSurface` apenas quando um instrumento da plataforma estiver dentro do canvas;
- remover aliases de release assim que o consumo chegar a zero;
- ao final, `release-analog` não pode aparecer no código de produção em `src`.

### P2 — A proteção automatizada cobre apenas uma lista pequena

Arquivo:

- `src/platform/leak-guard.test.ts`

Problema:

O teste protege somente os arquivos já incluídos manualmente nas listas. Ele fica verde mesmo com centenas de referências legadas fora dessas listas.

Correção necessária:

- a guarda final deve varrer o código de produção relevante;
- se existir exceção temporária, ela deve ser explícita, curta, justificada e acompanhada de tarefa de remoção;
- quando a migração terminar, a expectativa deve ser zero ocorrência.

### P2 — Idioma do produto acoplado ao idioma do manual

Arquivos envolvidos:

- `src/app/layout.tsx`
- `src/components/shell/PlatformTopBar.tsx`
- `src/components/shell/CommandPalette.tsx`
- `src/app/login/page.tsx`
- `src/app/onboarding/page.tsx`
- outros componentes que calculam `isEnglish` por `brandvilleInstance.metadata.language`.

Correção necessária:

- criar um conceito separado de locale da interface;
- usar locale do usuário quando existir;
- definir um fallback de produto, inicialmente `pt-BR`;
- o idioma da marca pode orientar o conteúdo do manual, mas não deve alterar automaticamente login, navegação, sessão e administração;
- eliminar a mistura atual de português e inglês no onboarding.

---

## 5. Arquitetura de implementação esperada

Os nomes abaixo são sugestões. O contrato é obrigatório; a nomenclatura pode se adaptar ao código.

### 5.1 Contexto da marca ativa

Criar uma resolução request-scoped que entregue, em um único resultado:

- contexto de autenticação;
- workspace ativo;
- papel/capacidades;
- marca ativa ou `null`;
- documentos da marca;
- locale da interface.

Evitar que cada página refaça autenticação, seleção da marca e consulta de documentos separadamente.

Não criar um singleton global mutável. Em uma aplicação multiusuário e multimarca, a marca ativa pertence à requisição/sessão, não ao módulo importado.

### 5.2 Propriedades explícitas nas fronteiras visuais

Contratos mínimos esperados:

- `AppShellV2`: identidade do produto, contexto da marca, seções autorizadas, locale e sessão;
- `WorkspaceIdentity`: `name`, `descriptor` e estado sem marca;
- `BrandCanvas`: tema e, quando necessário, tipografia da marca;
- busca: documentos e destinos da marca ativa;
- navegação: destinos filtrados por capacidades e locale da interface.

Não fazer componentes de apresentação importarem `brandvilleInstance` diretamente.

### 5.3 Fonte única para leitura e escrita

O mesmo `brand_id` resolvido deve atravessar:

- documentos;
- administração;
- versões;
- biblioteca de assets;
- chat e análise;
- configurações de IA;
- navegação e contexto da marca.

Se uma área ainda não estiver migrada, registrar a dívida e bloquear sua promoção como concluída. Não manter silenciosamente uma metade por `brand_id` e outra por `instance_key`.

---

## 6. Especificação da moldura responsiva

### 6.1 Desktop — 1024 px ou mais

- Topbar fixa na região superior, usando `--shell-topbar`.
- Sidebar de uma coluna usando `--shell-sidebar`.
- Canvas central com largura máxima controlada e margem estrutural.
- Busca visível como campo/acionador na topbar.
- Identidade Brennimark e contexto da marca visualmente distintos.
- Item ativo reconhecido por posição, peso e superfície; não apenas por cor.

### 6.2 Tablet — 768 a 1023 px

- Não comprimir indefinidamente a sidebar e o canvas.
- Preferir sidebar recolhível ou drawer persistente sob demanda.
- Campo de busca pode virar botão com rótulo reduzido.
- Identidade da marca pode ocultar descriptor antes de truncar o nome principal.

### 6.3 Mobile — abaixo de 768 px

- Nenhuma sidebar fixa ocupando a largura.
- Topbar compacta.
- Controle de menu com nome acessível.
- Busca em botão de no mínimo 44 × 44 px, abrindo a mesma command palette.
- Drawer/sheet com foco contido, fechamento por Escape, clique no scrim e botão explícito.
- Ao navegar, fechar o drawer.
- Conteúdo usa a largura disponível, respeitando padding seguro.
- Destinos prioritários podem ocupar navegação inferior, sem duplicar todos os destinos.
- Abertura do teclado não pode esconder o campo de busca ou o resultado selecionado.

### 6.4 Regras comuns

- Sem overflow horizontal em 320, 375, 390, 768, 1024 e 1440 px.
- Strings longas devem truncar de forma previsível, sem esconder a informação essencial.
- E-mail do usuário não pode expulsar busca, marca ou controles da topbar.
- Considerar safe areas em dispositivos móveis.

---

## 7. Estados obrigatórios

### 7.1 Sem marca

- Mostrar uma composição Brennimark limpa, sem rail ou painel vazio.
- Explicar o próximo passo.
- Enquanto o upload ainda não existir, não exibir botão morto.
- Quando o upload for implementado, substituir o texto técnico “criada diretamente no banco” por ação de produto.

### 7.2 Carregando

- Evitar tela vazia durante resolução da marca e documentos.
- Usar skeleton discreto ou estado de carregamento compatível com a geometria final.
- Não simular conteúdo de marca.

### 7.3 Erro

- Diferenciar falha de sessão, falha de rede, marca inexistente e documento inexistente.
- Mensagens pertencem ao Brennimark e usam tokens de plataforma.
- Oferecer recuperação possível: tentar novamente, voltar ou entrar novamente.

### 7.4 Sem permissão

- Destinos sem capacidade não aparecem na navegação.
- O servidor continua sendo a autoridade final.
- Acesso direto a uma rota sem capacidade deve receber resposta segura e compreensível.

### 7.5 Conteúdo longo e internacionalização

- Testar nomes longos de marca, títulos longos, alemão/inglês e e-mails longos.
- Não depender de caixa alta para formar toda a hierarquia.
- Controles devem suportar expansão de texto sem quebrar a composição.

---

## 8. Movimento e interação

Usar os tokens já definidos:

- controle: `--motion-control`;
- menu: `--motion-menu`;
- painel/drawer: `--motion-panel`;
- easing: `--ease-shell`.

Regras:

- movimento deve indicar relação espacial ou mudança de estado;
- drawer entra pela borda correspondente e o scrim aparece junto;
- command palette pode usar leve deslocamento e opacidade;
- não adicionar animação ornamental permanente;
- respeitar `prefers-reduced-motion`.

---

## 9. Acessibilidade

- Navegação principal com nome acessível adequado ao locale da interface.
- Ordem de foco deve seguir a ordem visual.
- Command palette com padrão coerente de dialog + combobox/listbox.
- Drawer mobile deve conter o foco enquanto aberto e devolver o foco ao acionador ao fechar.
- Escape fecha palette e drawer.
- Estado ativo deve usar `aria-current="page"`.
- Alvos de toque mínimos de 44 × 44 px.
- Foco visível sempre usa token da plataforma em controles da moldura.
- Status nunca comunicado apenas por cor.
- Contraste mínimo WCAG 2.1 AA para texto e controles.

---

## 10. Teste com marcas visualmente opostas

Antes de promover a V2, testar a moldura com quatro fixtures sem criar branches condicionais por identidade:

1. **Marca escura e sóbria** — preto, cinzas, tipografia editorial.
2. **Marca clara institucional** — branco e azul.
3. **Marca saturada** — vermelho/laranja com alto contraste.
4. **Marca expressiva multicolorida** — paleta ampla e tipografia de personalidade forte.

Para cada fixture verificar:

- canvas respeita tema da marca;
- moldura Brennimark permanece constante;
- status, busca e controles continuam legíveis;
- nenhuma cor da marca invade plataforma;
- nenhum token de plataforma altera demonstrações da marca;
- transição entre marcas não exige reload de build nem variável de ambiente diferente;
- desktop e mobile permanecem funcionais.

A fixture clara azul é obrigatória porque expõe colisões com qualquer sinal azul que venha a ser considerado para o Brennimark.

---

## 11. Plano de execução em patches revisáveis

Não entregar tudo em um commit único.

### Patch 1 — Fonte única da marca ativa

- Introduzir resolução request-scoped.
- Fazer `/docs` reconhecer a marca do banco.
- Passar identidade e tema explicitamente.
- Remover decisões de runtime baseadas em `hasBrand` estático.
- Adicionar testes.

### Patch 2 — Escrita, histórico e autorização por `brand_id`

- Migrar administração.
- Migrar versões/restauração.
- Ajustar esquema por migração aditiva.
- Garantir isolamento por workspace e marca.
- Adicionar testes de leitura após escrita.

### Patch 3 — Locale da interface

- Separar locale do produto e idioma do manual.
- Uniformizar login e onboarding.
- Remover imports de marca usados apenas para decidir microcopy da plataforma.

### Patch 4 — V2 mobile e paridade funcional

- Implementar topbar e navegação mobile.
- Resolver tablet.
- Conferir busca, sessão, permissões, empty state, loading e erro.
- Executar testes visuais nos breakpoints.

### Patch 5 — Promoção da V2

- Colocar `AppShellV2` em `/docs`.
- Validar rotas filhas.
- Remover a dependência de produção em `DocsNav`.
- Manter rollback simples durante a revisão, sem duas interfaces permanentes.

### Patch 6 — Remoção da herança visual

- Migrar componentes remanescentes para namespaces explícitos.
- Expandir leak guard.
- Remover `release-analog` do código de produção.
- Remover aliases quando não houver consumidores.

Cada patch deve começar e terminar com `npm run verify` verde.

---

## 12. Testes mínimos que faltam

Adicionar proteção para estes cenários:

1. Ambiente sem instância estática + marca presente no banco não mostra estado vazio.
2. A marca ativa define nome, descriptor, tema e documento padrão.
3. Duas marcas do mesmo workspace não misturam documentos.
4. Usuário de outro workspace não acessa a marca.
5. Administração grava `brand_id` e a leitura nova encontra imediatamente o documento.
6. Histórico e restauração operam sobre a mesma marca ativa.
7. `BrandCanvas` recebe o tema da marca resolvida, sem importar singleton estático.
8. Moldura usa locale da interface, não idioma da marca.
9. `/docs` monta `AppShellV2`, não `DocsNav`.
10. Viewports 320, 390, 768, 1024 e 1440 não têm overflow horizontal.
11. No mobile, sidebar desktop não é renderizada/visível.
12. Drawer e command palette preservam foco e teclado.
13. Guarda global encontra zero `release-analog` no código de produção ao final da migração.
14. As quatro fixtures visuais preservam o isolamento dos tokens.

Não enfraquecer testes existentes, não adicionar `continue-on-error` e não excluir caminhos da guarda apenas para deixá-la verde.

---

## 13. Critérios de aceite finais

Esta etapa só está concluída quando todos os itens abaixo forem verdadeiros:

- [ ] Uma marca criada no banco aparece em `/docs` sem configuração de build específica.
- [ ] Nome, descriptor, tema, navegação e documentos pertencem à mesma marca resolvida.
- [ ] Trocar de marca não exige rebuild.
- [ ] Administração e histórico usam `brand_id` e respeitam workspace/autorização.
- [ ] `/docs` usa a moldura V2 em produção.
- [ ] `DocsNav` não participa mais da interface real.
- [ ] A V2 funciona em desktop, tablet e mobile.
- [ ] Não existe overflow horizontal nos breakpoints definidos.
- [ ] O canvas é visualmente dominante e a moldura não invade a identidade da marca.
- [ ] Login, onboarding, busca e administração usam locale de interface coerente.
- [ ] Não existem ocorrências de `release-analog` em código de produção dentro de `src`.
- [ ] A leak guard cobre o escopo real, não apenas uma lista pequena de arquivos.
- [ ] As quatro marcas opostas passam no teste de isolamento.
- [ ] Lint, tipos, testes, build e CI permanecem verdes.
- [ ] A identidade visual definitiva do Brennimark continua centralizada e substituível, sem decisões inventadas nesta fatia.

---

## 14. Entrega esperada do CODE

Antes de começar, responder com:

1. confirmação do diagnóstico;
2. mapa dos arquivos e esquemas afetados;
3. riscos de dados e migração;
4. sequência proposta de patches;
5. qualquer conflito real encontrado entre este briefing e o código atual.

Ao concluir cada patch, informar:

- commit;
- arquivos alterados;
- comportamento anterior e novo;
- testes adicionados;
- resultado de `npm run verify`;
- evidência visual desktop/mobile quando aplicável;
- dívida explicitamente deixada para o patch seguinte.

Não declarar a nova interface implantada enquanto ela continuar exclusiva de `/dev/shell-v2` ou enquanto `/docs` ainda montar `DocsNav`.
