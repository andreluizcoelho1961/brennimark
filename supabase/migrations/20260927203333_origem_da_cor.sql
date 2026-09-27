-- De onde veio cada cor da ficha: pessoa ou IA — 27/09/2026.
--
-- ─── Por quê ────────────────────────────────────────────────────────────────
--
-- Decisão do André, 27/09/2026: a ficha da paleta passa a poder ser SUGERIDA
-- pela IA, que lê as imagens das páginas de cor do manual (#50). A sugestão
-- nasce rascunho, como toda cor (o gatilho já garante), e uma pessoa confere e
-- aprova. Numa auditoria do dono da marca, "quem leu este código?" é pergunta
-- legítima — daí a coluna, e não só o status.
--
--   pessoa  cadastrada por alguém, à mão (o que existia até aqui);
--   ia      lida pela IA das imagens das páginas.
--
-- A origem é de NASCIMENTO e não muda: corrigir uma cor sugerida não a torna
-- "de pessoa" — quem corrigiu fica em `updated_by`, que já existe.
--
-- ⚖️ Tradeoff: uma coluna e três linhas no gatilho. Reversível: apagar a coluna
-- não toca em cor nenhuma. As linhas que já existem são de pessoa: até hoje só
-- havia cadastro à mão.

alter table public.paleta_da_marca
  add column origem text not null default 'pessoa',
  add constraint paleta_da_marca_origem_check check (origem in ('pessoa', 'ia'));

create or replace function private.governar_paleta_da_marca()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  quem uuid := (select auth.uid());
  conteudo_mudou boolean;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'a cor nasce como rascunho; a aprovação é um passo à parte'
        using errcode = 'check_violation', constraint = 'paleta_da_marca_nasce_rascunho';
    end if;
    new.aprovado_por := null;
    new.aprovado_em  := null;
    new.created_by   := coalesce(quem, new.created_by);
    new.updated_by   := coalesce(quem, new.updated_by);
    new.created_at   := now();
    new.updated_at   := now();
    return new;
  end if;

  -- Uma cor não muda de marca: seria copiar aprovação de uma marca para outra.
  if new.brand_id <> old.brand_id or new.workspace_id <> old.workspace_id then
    raise exception 'a cor não muda de marca'
      using errcode = 'check_violation', constraint = 'paleta_da_marca_marca_fixa';
  end if;

  conteudo_mudou := (new.nome, new.papel, new.segmento, new.hex, new.rgb, new.cmyk, new.pms, new.pagina)
    is distinct from (old.nome, old.papel, old.segmento, old.hex, old.rgb, old.cmyk, old.pms, old.pagina);

  if new.status = 'ready' and old.status = 'draft' then
    -- Aprovar: só quem tem `aprovar` nesta marca.
    if quem is not null and not public.tem_capacidade_na_marca(new.brand_id, 'aprovar') then
      raise exception 'só quem aprova esta marca aprova a cor'
        using errcode = 'insufficient_privilege', constraint = 'paleta_da_marca_aprovar_exige_capacidade';
    end if;
    new.aprovado_por := quem;
    new.aprovado_em  := now();
  elsif new.status = 'ready' and conteudo_mudou then
    -- Alterou o que estava aprovado: volta a rascunho.
    new.status       := 'draft';
    new.aprovado_por := null;
    new.aprovado_em  := null;
  elsif new.status = 'ready' then
    -- Só a ordem mudou: a aprovação continua a mesma, e ninguém a reescreve.
    -- Escrita de sistema passa: é por ela que chega o `on delete set null` de
    -- quem aprovou e teve o login apagado — travá-la travaria a exclusão.
    if quem is not null then
      new.aprovado_por := old.aprovado_por;
      new.aprovado_em  := old.aprovado_em;
    end if;
  else
    new.aprovado_por := null;
    new.aprovado_em  := null;
  end if;

  -- A autoria não se reescreve por sessão; o sistema a anula (conta removida).
  -- A ORIGEM também não (27/09): uma cor sugerida pela IA e corrigida por uma
  -- pessoa continua dizendo que nasceu da IA — `updated_by` diz quem corrigiu.
  if quem is not null then
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.origem     := old.origem;
  end if;
  new.updated_by := coalesce(quem, new.updated_by);
  new.updated_at := now();
  return new;
end;
$$;
