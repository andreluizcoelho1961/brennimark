# Changelog

## 2026-07-21 — Onboarding replicável

- Novo questionário guiado para iniciar uma instância sem editar a matriz manualmente.
- Manifesto único de identidade, navegação, conteúdo, tema, IA e aviso legal.
- Validação preventiva de contrato, slugs, grupos, códigos, estados e contraste.
- Geração automática da instância, registro, estrutura de assets e checklist de lançamento.
- Modos de validação e simulação que não alteram arquivos.
- Importador de brand books em PDF com páginas de origem, proposta de seções e relatório de revisão.
- Bloqueio explícito de PDFs escaneados ou sem texto suficiente, evitando conteúdo inventado.
- Camada de curadoria para cortes, correções editoriais, tokens confirmados e decisões pendentes.
- Índice privado que liga documentos curados às páginas visuais renderizadas do PDF.

## 2026-07-21 — Histórico e auditoria editorial

- Cada publicação, edição e restauração para a matriz gera uma versão imutável.
- A linha do tempo informa data, responsável, status e campos alterados.
- Proprietários podem recuperar qualquer versão preservada sem apagar a versão atual.
- A auditoria é criada automaticamente por trigger no banco, inclusive para futuras integrações.
- O aplicativo possui somente permissão de leitura sobre a tabela de versões; registros não podem ser forjados, editados ou apagados pelo navegador.

## 2026-07-21 — Roteamento configurável de IA

- A tela de IA permite escolher conexões principal e de reserva separadamente para o chat e para a análise de peças.
- O limite de espera antes da troca pode ser definido entre 3 e 60 segundos.
- A troca entre empresas fornecedoras de IA exige autorização explícita; sem consentimento, o servidor bloqueia a reserva de outro provedor mesmo que a interface seja contornada.
- Uma mesma conexão pode ser disponibilizada para chat, análise ou ambos os recursos.
- Chat e análise respeitam as políticas persistidas; a análise também tenta a reserva quando a principal falha ou excede o prazo.
- As chaves continuam criptografadas e nunca são devolvidas pela API ou exibidas integralmente na tela.
- As políticas são isoladas por workspace com Row Level Security.
