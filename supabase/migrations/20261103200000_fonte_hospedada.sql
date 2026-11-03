-- A fonte da marca passa a ser hospedada — ADR-0007 §3, 03/11/2026.
--
-- ─── A decisão (André, 03/11) ───────────────────────────────────────────────
--
-- "Sem baixar a fonte da marca, o designer, o prestador e a gráfica não
-- trabalham nela." Vale para TODAS as marcas, desde o dia em que entra no ar.
--
-- O ADR-0007 §3 pôs quatro condições. Como cada uma é cumprida aqui:
--
--   1. O termo existe antes de a hospedagem ser ligada → o texto é uma linha
--      de `versoes_do_termo_de_fonte`, numerada e com impressão digital. Sem uma
--      versão válida no pedido, o banco recusa o arquivo (a constraint que já
--      existia, `brand_assets_fonte_exige_termo`, continua sendo o nome).
--   2. Aceite registrado no upload, com autor e data → `termo_versao`,
--      `termo_aceito_por` e `termo_aceito_em` na própria variante. Quem carimba é
--      o BANCO, a partir da sessão; o que o pedido mandar nesses dois campos é
--      descartado.
--   3. Procedimento de retirada → `retirada_em` e `retirada_motivo`. Só quem
--      ADMINISTRA a marca (ou a chave de serviço) retira, e o registro de quem
--      baixou continua legível.
--   4. Só download, só a quem alcança a marca → nada muda no Storage: a rota
--      do kit assina com a chave de serviço, por 120 s, e registra antes.
--
-- ─── O que esta migration NÃO resolve ───────────────────────────────────────
--
-- O texto da versão 1 foi redigido por engenheiro, não por advogado. O aceite
-- registrado no produto é a forma de "assinado" desta fase; a revisão jurídica
-- entra como VERSÃO 2 (nova linha, nunca edição da v1: o aceite de quem já
-- aceitou continua apontando para o texto que ele viu).
--
-- Aditiva: nada existente é alterado nem apagado. Em produção há 93 arquivos,
-- 33 itens e nenhum item de fonte (conferido em 03/11).

-- ─── O termo, versionado ────────────────────────────────────────────────────

create table public.versoes_do_termo_de_fonte (
  versao       text primary key,
  texto_pt     text not null,
  texto_en     text not null,
  -- Impressão digital do texto em português: prova de qual texto foi aceito.
  sha256       text not null,
  publicada_em timestamptz not null default now(),
  constraint versoes_do_termo_de_fonte_versao_check check (versao ~ '^[0-9]{1,3}$')
);

alter table public.versoes_do_termo_de_fonte enable row level security;

-- Qualquer pessoa autenticada lê: o texto aparece antes do aceite. Escrever, só
-- migration — nem quem administra reescreve o texto que alguém aceitou.
create policy "Quem entrou lê as versões do termo de fonte"
  on public.versoes_do_termo_de_fonte for select to authenticated
  using (true);

revoke all on public.versoes_do_termo_de_fonte from anon;
revoke all on public.versoes_do_termo_de_fonte from authenticated;
grant select on public.versoes_do_termo_de_fonte to authenticated;

insert into public.versoes_do_termo_de_fonte (versao, texto_pt, texto_en, sha256)
select '1', pt, en, encode(sha256(convert_to(pt, 'UTF8')), 'hex')
from (select
$pt$Termo de hospedagem de fonte — versão 1

1. Quem declara. Ao enviar uma fonte, você declara que é dono ou representante da marca e que tem, para essa fonte, licença que permite o uso por quem trabalha na marca: a equipe, as agências, as gráficas e os fornecedores que a marca autorizar.

2. Responsabilidade. A responsabilidade pela licença da fonte é do assinante. O Brennimark guarda o arquivo e o entrega a quem a marca autorizou; não verifica nem garante a licença.

3. Como a fonte é entregue. Só para download, a pessoas autenticadas que alcançam a marca, ou por link de entrega com prazo. Nunca por endereço público e nunca como webfont. Cada download fica registrado: quem baixou, quando e qual arquivo.

4. Licença que exige licença própria. Se a licença da fonte exigir licença de cada fornecedor, o assinante informa isso e como obtê-la, e o produto mostra essa informação a quem baixa.

5. Retirada. Se a fundição que licencia a fonte pedir, o Brennimark pode retirá-la e avisar o assinante e quem a baixou, com base no registro de downloads.

6. Registro do aceite. Este aceite é registrado com seu nome, a data e a versão deste texto, a cada envio de fonte.$pt$::text as pt,
$en$Font hosting terms — version 1

1. Who declares. By uploading a font, you declare that you own the brand or represent it, and that you hold a license for this font that allows use by the people who work on the brand: the team, the agencies, the print shops and the suppliers the brand authorizes.

2. Responsibility. The subscriber is responsible for the font license. Brennimark stores the file and delivers it to whoever the brand authorized; it does not verify or guarantee the license.

3. How the font is delivered. Download only, to signed-in people who have access to the brand, or through a delivery link with an expiry date. Never at a public address and never as a webfont. Every download is recorded: who downloaded, when and which file.

4. A license that requires its own license. If the font license requires each supplier to hold their own, the subscriber says so and how to get it, and the product shows that information to whoever downloads.

5. Withdrawal. If the foundry that licenses the font asks, Brennimark may withdraw it and notify the subscriber and whoever downloaded it, based on the download record.

6. Record of acceptance. This acceptance is recorded with your name, the date and the version of this text, every time a font is uploaded.$en$::text as en
) t;

-- ─── Licença: informação do item, mostrada na hora do download (ADR §3.3) ───

alter table public.brand_asset_items
  add column licenca_tipo       text,
  add column licenca_titular    text,
  add column licenca_como_obter text,
  add constraint brand_asset_items_licenca_tipo_check
    check (licenca_tipo is null or licenca_tipo in ('livre', 'exclusiva', 'comprada')),
  add constraint brand_asset_items_licenca_titular_check
    check (licenca_titular is null or char_length(licenca_titular) <= 120),
  add constraint brand_asset_items_licenca_como_obter_check
    check (licenca_como_obter is null or char_length(licenca_como_obter) <= 500);

-- ─── Aceite e retirada na variante ──────────────────────────────────────────

alter table public.brand_assets
  add column termo_versao     text references public.versoes_do_termo_de_fonte(versao),
  add column termo_aceito_por uuid references auth.users(id) on delete set null,
  add column termo_aceito_em  timestamptz,
  add column retirada_em      timestamptz,
  add column retirada_motivo  text,
  add constraint brand_assets_termo_completo
    check ((termo_versao is null) = (termo_aceito_em is null)),
  add constraint brand_assets_retirada_motivo_check
    check (retirada_motivo is null or (retirada_em is not null and char_length(retirada_motivo) <= 500));

create index brand_assets_termo_por_idx on public.brand_assets (termo_aceito_por) where termo_aceito_por is not null;
create index brand_assets_termo_versao_idx on public.brand_assets (termo_versao) where termo_versao is not null;

-- ─── A conferência da fonte entra no gatilho dos eixos ──────────────────────
--
-- É a função de 17/09 com UM bloco trocado: o que era "fonte nunca" vira
-- "fonte com termo, licença e formato de instalar". O resto é idêntico.
-- Cada recusa leva o nome de uma constraint, e a prova confere o NOME.

create or replace function private.conferir_eixos_da_variante()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  tipo_do_item text;
  licenca text;
  extensao text;
begin
  -- Quem não edita esta marca não chega à conferência: a RLS recusa a linha
  -- logo depois, com 42501. Sem este desvio, a função (que enxerga tudo)
  -- responderia "o item não existe nesta marca" a um estranho e outra coisa a
  -- quem acertasse um id — um oráculo de existência. A prova pegou em 17/09.
  --
  -- `auth.uid()` nulo é escrita de sistema (service role, migration): essa
  -- passa pela conferência inteira, senão o atalho viraria brecha de eixo.
  if (select auth.uid()) is not null
     and not public.tem_capacidade_na_marca(new.brand_id, 'editar') then
    return new;
  end if;

  select i.tipo, i.licenca_tipo into tipo_do_item, licenca
    from public.brand_asset_items i
   where i.id = new.item_id and i.brand_id = new.brand_id;

  -- A FK composta também recusaria; aqui a recusa sai com nome legível.
  if tipo_do_item is null then
    raise exception 'o item não existe nesta marca'
      using errcode = 'foreign_key_violation', constraint = 'brand_assets_item_fkey';
  end if;

  if tipo_do_item = 'fonte' then
    -- 1. O termo: uma versão que existe. Sem ela, nada entra.
    if new.termo_versao is null
       or not exists (select 1 from public.versoes_do_termo_de_fonte v where v.versao = new.termo_versao) then
      raise exception 'fonte só é aceita com o termo de licença aceito (ADR-0007 §3)'
        using errcode = 'check_violation', constraint = 'brand_assets_fonte_exige_termo';
    end if;
    -- 2. A licença dita no item, para ser mostrada a quem baixa.
    if licenca is null then
      raise exception 'fonte exige o tipo de licença informado no item'
        using errcode = 'check_violation', constraint = 'brand_assets_fonte_exige_licenca';
    end if;
    -- 3. Só formato de instalar: nada de webfont.
    extensao := lower(substring(new.file_name from '\.([^.]+)$'));
    if extensao is null or extensao not in ('otf', 'ttf', 'ttc')
       or new.mime_type not in ('font/otf', 'font/ttf', 'font/collection') then
      raise exception 'fonte só em OTF, TTF ou TTC; webfont não é hospedada'
        using errcode = 'check_violation', constraint = 'brand_assets_fonte_formato';
    end if;
    if new.hierarquia is not null or new.lockup is not null or new.cor is not null
       or new.polaridade is not null or new.espaco_de_cor is not null then
      raise exception 'fonte não tem eixos'
        using errcode = 'check_violation', constraint = 'brand_assets_eixos_fora_do_tipo';
    end if;
    -- 4. Quem aceitou e quando vêm da SESSÃO, nunca do pedido. Só na criação:
    --    corrigir um eixo depois não pode re-carimbar o aceite de outra pessoa.
    if tg_op = 'INSERT' then
      new.termo_aceito_por := (select auth.uid());
      new.termo_aceito_em  := clock_timestamp();
    end if;
    return new;
  end if;

  -- Fora da fonte, não há aceite nem retirada de termo.
  if new.termo_versao is not null then
    raise exception 'o termo de fonte só vale para fonte'
      using errcode = 'check_violation', constraint = 'brand_assets_termo_fora_do_tipo';
  end if;

  if tipo_do_item = 'logo' then
    if new.hierarquia is null or new.lockup is null or new.cor is null
       or new.polaridade is null or new.espaco_de_cor is null then
      raise exception 'logo exige hierarquia, lockup, cor, polaridade e espaço de cor'
        using errcode = 'check_violation', constraint = 'brand_assets_eixos_do_logo';
    end if;
    return new;
  end if;

  if new.hierarquia is not null or new.lockup is not null then
    raise exception 'hierarquia e lockup são eixos só do logo'
      using errcode = 'check_violation', constraint = 'brand_assets_eixos_fora_do_tipo';
  end if;

  if tipo_do_item = 'icone' then
    if new.cor is null or new.polaridade is null or new.espaco_de_cor is null then
      raise exception 'ícone exige cor, polaridade e espaço de cor'
        using errcode = 'check_violation', constraint = 'brand_assets_eixos_do_icone';
    end if;
    return new;
  end if;

  if new.cor is not null or new.polaridade is not null then
    raise exception 'cor e polaridade não se aplicam a %', tipo_do_item
      using errcode = 'check_violation', constraint = 'brand_assets_eixos_fora_do_tipo';
  end if;

  if tipo_do_item in ('paleta', 'gabarito') and new.espaco_de_cor is null then
    raise exception '% exige espaço de cor', tipo_do_item
      using errcode = 'check_violation', constraint = 'brand_assets_espaco_de_cor_obrigatorio';
  end if;

  return new;
end;
$$;

revoke execute on function private.conferir_eixos_da_variante() from public, anon, authenticated;

-- ─── O aceite não se reescreve; a retirada é de quem administra ─────────────
--
-- A policy de UPDATE deixa quem EDITA a marca alterar a variante. Duas coisas
-- ficam fora disso: o aceite (quem, quando, qual versão) é fato do passado, e a
-- retirada é decisão de administração (ou da chave de serviço, no Console).

create function private.proteger_aceite_e_retirada()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  -- A única mudança permitida em `termo_aceito_por` é virar nulo porque o login
  -- foi apagado (a chave é `on delete set null`): a exclusão de conta não pode
  -- ser bloqueada por aqui, e a pessoa some, o aceite fica.
  if new.termo_versao     is distinct from old.termo_versao
     or new.termo_aceito_em  is distinct from old.termo_aceito_em
     or (new.termo_aceito_por is distinct from old.termo_aceito_por
         and not (new.termo_aceito_por is null
                  and not exists (select 1 from auth.users u where u.id = old.termo_aceito_por))) then
    raise exception 'o aceite do termo não se reescreve'
      using errcode = '42501', constraint = 'brand_assets_aceite_imutavel';
  end if;

  if (new.retirada_em is distinct from old.retirada_em
      or new.retirada_motivo is distinct from old.retirada_motivo)
     and (select auth.uid()) is not null
     and not public.tem_capacidade_na_marca(new.brand_id, 'administrar') then
    raise exception 'retirar uma fonte é de quem administra a marca'
      using errcode = '42501', constraint = 'brand_assets_retirada_so_admin';
  end if;
  return new;
end;
$$;

revoke execute on function private.proteger_aceite_e_retirada() from public, anon, authenticated;

create trigger brand_assets_proteger_aceite_e_retirada
  before update on public.brand_assets
  for each row execute function private.proteger_aceite_e_retirada();
