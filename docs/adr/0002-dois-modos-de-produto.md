# ADR-0002 — Dois modos de produto: agência e consulta

- **Status:** proposto, aguardando aprovação
- **Data:** 28/08/2026
- **Relaciona-se com:** ADR-0001 (Studio como control plane), briefing de evolução §7 e §8
- **Decisão irreversível?** A separação, não. Os limites de cada modo, sim — ver §7.

---

## 1. O que mudou

Até aqui o produto era tratado como "um brand book digital com IA". A definição agora é
mais precisa, e ela tem consequência de arquitetura:

> É o produto de uma startup, vendido a agências de publicidade, que gerenciam as marcas de
> seus clientes. E é também usado pelo lado do cliente, que consulta a marca sem editá-la.

São **duas experiências diferentes do mesmo sistema**, não dois níveis de permissão do mesmo
aplicativo.

## 2. Os dois modos

### Modo agência — quem constrói e mantém

A agência comprou um pacote e está desenvolvendo ou administrando marcas para seus clientes.
Ela precisa de:

- carteira: ver os vários clientes com quem trabalha;
- alimentar e alterar o conteúdo de cada manual;
- governar: aprovar, versionar, registrar autoria e validade;
- operar: convites, papéis, assets, configurações de IA;
- medir: uso, custo e estágio de implantação de cada marca.

### Modo consulta — quem usa a marca

A Coca-Cola comprou o aplicativo. Quem abre é um designer interno, uma agência prestadora ou um
fornecedor. Essa pessoa precisa de:

- **uma marca só** — a dela, sem existir sinal de que há outras;
- consultar a regra, com o motivo e o estado editorial;
- perguntar ao assistente e receber resposta com a fonte;
- validar uma peça contra a marca;
- baixar o asset certo.

E precisa **não ver** superfície de edição. Não é botão desabilitado: é ausência.

## 3. Por que "esconder o botão" não basta

Hoje a diferença entre editar e consultar é o papel `owner` verificado em cada rota
(`src/app/api/admin/*`, `src/app/docs/layout.tsx:31`). A autorização está correta e no servidor.

Mas isso resolve **permissão**, não **experiência**. Um consultor que vê um aplicativo cheio de
controles que não pode usar entende que está num produto feito para outra pessoa. E é o oposto do
que a marca quer transmitir ao seu fornecedor.

A separação precisa ser de composição — quais destinos existem, o que a home mostra, o que a
navegação oferece — e não de `disabled`.

## 4. Decisão

**Adotar dois modos explícitos do mesmo sistema, resolvidos por capacidade e não por papel.**

1. Uma configuração tipada declara as **capacidades** de quem está usando, por marca:

   | Capacidade | O que permite |
   |---|---|
   | `consultar` | ler o guia, perguntar ao assistente, analisar peça, baixar asset |
   | `editar` | redigir e alterar conteúdo; **não** muda estado editorial |
   | `aprovar` | mudar status, publicar release, autoridade editorial |
   | `administrar` | membros, papéis, chaves de IA, gestão de assets |

   **`editar` e `aprovar` são separados de propósito.** É como governança de marca funciona: a
   agência redige, o dono da marca aprova. O aplicativo já modela isso com
   `ready | draft | pending` e o histórico de versões. Sem a separação, dar edição à agência daria
   também autoridade editorial sobre a marca do cliente — que nenhum gestor de marca aceitaria.

   O manual da Guitar Garage diz literalmente: *aprova aplicação: Solon Fishbone*, *autor do
   sistema: André Coelho*. Quem autora não é quem aprova.
2. A moldura V2 monta os destinos a partir dessa configuração. Um consultor não recebe rota que
   terminaria em 403 nem controle que não pode acionar.
3. A autorização de servidor permanece exatamente como está. Capacidade decide o que aparece;
   RLS e verificação de papel decidem o que é permitido. **Interface nunca é a fronteira de
   segurança.**
4. O modo consulta é o padrão. O modo agência é aditivo.

### Por que capacidade e não papel

Papel é quem a pessoa é; capacidade é o que ela pode fazer aqui. Um mesmo `owner` pode ser
agência numa instalação e consultor em outra. Amarrar a composição da interface ao papel forçaria
a interface a saber de contratos comerciais — que mudam mais rápido que código.

### Alcance é outro eixo, não uma capacidade

Quantas marcas o login enxerga — uma instalação ou uma carteira — é ortogonal ao que a pessoa pode
fazer dentro de cada uma. Os cenários reais são combinações dos dois eixos:

| Quem | Alcance | Capacidades |
|---|---|---|
| Designer da marca cliente | uma | consultar |
| Gestor de marca do cliente | uma | consultar, aprovar |
| Agência trabalhando naquela marca | uma | consultar, editar |
| Estúdio com carteira própria | várias | varia por marca |

A última linha é o motivo de a capacidade ser **por marca** e não global: a mesma pessoa pode
editar a marca A e apenas consultar a marca B.

### Nome

**`Studio` permanece com o sentido do ADR-0001: a carteira da agência.** O modo de uma marca só
recebe nome quando a identidade comercial existir; até lá é descrito funcionalmente como
*consulta*. Isso evita reescrever ADR-0001, o briefing de evolução e o plano do WP4, onde
`Studio` já aparece com esse sentido.

## 5. Como isso conversa com o ADR-0001

**Confirma a Opção 1 em vez de contradizê-la**, e vale registrar porque a leitura inicial sugeria
o contrário.

O modo consulta é, por natureza, uma instalação com uma marca só. É exatamente o isolamento por
projeto separado que o ADR-0001 recomendou: a Coca-Cola tem banco, domínio, usuários e chaves
próprios, e não existe caminho técnico até outra marca — nem por erro de policy.

A carteira da agência é o Studio: plano de controle sobre instalações isoladas, com metadados e
métricas agregadas, sem conteúdo nem chaves.

### O ponto que o ADR-0001 não cobria

A agência precisa **editar** o manual do cliente. O ADR-0001 diz que o Studio não recebe conteúdo.
Os dois só são compatíveis de uma forma:

> A agência edita **dentro da instalação do cliente**, com a autenticação da própria instalação.
> O Studio é a porta e a visão de carteira, não o editor.

Na prática: uma pessoa da agência é membro com capacidade de edição na instalação da Coca-Cola. O
Studio a leva até lá; não edita por ela. Isso preserva a restrição §6.1 do ADR-0001 e evita que o
control plane acumule o conteúdo de todos os clientes — que seria o pior alvo possível.

## 6. Consequências

**Positivas:** o consultor vê um produto feito para ele; a agência tem carteira sem que o Studio
vire depósito de conteúdo alheio; a composição da V2 passa a ter uma fonte declarada, em vez de
condicionais espalhadas; e a separação já existente de `owner`/`member` continua valendo sem
reescrita.

**Negativas, assumidas:** mais um conceito a manter (capacidade, além de papel); risco de as duas
composições divergirem em acabamento se só uma for exercitada; e o modo agência não pode ser
testado de verdade antes de existir mais de uma instalação real.

**Não muda agora:** banco, autenticação, papéis `owner`/`member`, rotas ou RLS.

## 7. O que esta decisão trava

**Trava:** o vocabulário de capacidades. Depois que a navegação e as telas dependerem dele,
renomear ou reagrupar exige tocar em tudo que o consome. Vale fechar a lista com calma.

**Não trava:** a topologia. Se um dia uma agência pequena justificar várias marcas num banco só,
os dois modos continuam válidos — muda onde o dado mora, não quem vê o quê.

## 8. Fora desta decisão

Preço, empacotamento comercial, nome das ofertas e quem paga o quê. O briefing de evolução §24
lista essas como decisões humanas, e nada aqui as presume. Este ADR descreve **estrutura de
produto**, não oferta.

## 9. Revisão

Reavaliar quando: existir a primeira instalação em modo consulta com usuário externo real; ou uma
agência pedir edição a partir da carteira sem entrar na instalação — que é o pedido que forçaria
reabrir a §5.
