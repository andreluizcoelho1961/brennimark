# Limite do projeto — Brennimark

## Este repositório é o produto

Aqui vivem:

- aplicação Next.js e APIs;
- autenticação, workspaces, permissões e isolamento multi-tenant;
- banco de dados e migrations;
- IA com fontes, análise de peças, histórico e governança humana;
- gerador/importador de instâncias;
- onboarding, pricing, demo comercial e documentação do produto;
- materiais técnicos, comerciais e de investimento da startup.

**Brennimark** é o nome de trabalho do produto. `Brandville` é codinome legado que ainda aparece
em identificadores internos e não pode voltar à interface.

## As marcas são dados, não o produto

Uma marca é conteúdo carregado na plataforma — nunca código versionado aqui. Cada uma mantém sua
própria fonte da verdade fora deste repositório, e entra pelo mesmo caminho que qualquer cliente
usará: importação de manual.

**Nenhuma marca vive neste repositório.** The BluesMaker, Hairline e Guitar Garage existiam aqui
como instâncias em código e foram removidos por inteiro em 28/08/2026 — instâncias, componentes
exclusivos, conteúdo, assets e fontes licenciadas. Recriar qualquer um deles em código seria
desfazer a decisão do [ADR-0003](./adr/0003-produto-hospedado-multi-marca.md).

Se precisar de uma marca para testar, importe um PDF.

Uma instância não pode:

- definir o posicionamento comercial da plataforma;
- alterar componentes genéricos para simular uma necessidade não validada;
- misturar direitos autorais, fontes ou ativos entre marcas;
- ser apresentada como prova de product-market fit ou repetibilidade.

## Contrato com projetos externos

```text
projeto da marca → release aprovada → adaptador/importador → instância da plataforma
```

A plataforma pode manter mapeamento, status editorial, telemetria, demo e recursos de IA.
O projeto externo mantém fatos, regras, voz, tokens, ativos e aprovações da marca.

## Materiais do investidor

O relatório de pré-investimento pertence a este projeto porque avalia a startup e seu modelo
de distribuição. Uma marca usada em demonstração é apenas evidência de qualidade de conteúdo;
não comprova canal, CAC, retenção ou margem.
