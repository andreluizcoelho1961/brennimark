-- Limite de taxa nas rotas públicas (auditoria de 09/11/2026, A1) — decisão do André em 09/11/2026:
-- contador no próprio banco, sem serviço externo.
--
-- O QUE MUDA
--   - tabela `limites_de_taxa`: um contador por (chave, janela). A chave é um RESUMO (sha-256) do que
--     se limita — nunca o IP nem o e-mail em claro — prefixado pela rota (`cadastro:<resumo>`). A
--     janela é de tamanho fixo (início arredondado), então o contador se renova sozinho;
--   - `limite_de_taxa_tentar(chave, limite, janela_em_segundos)`: soma 1 ao contador DA JANELA ATUAL de
--     forma atômica (upsert) e devolve `true` se ainda está dentro do limite. Só a chave de serviço
--     executa; as rotas públicas a chamam pelo servidor, nunca pelo navegador;
--   - a limpeza é preguiçosa: ~2% das chamadas apagam as janelas de mais de 2 dias. Sem cron novo.
--
-- Por que fixa e não deslizante: simples e barata, e o pior caso é o dobro do limite na virada da janela.
-- Para conter abuso de e-mail isso basta; precisão de cobrança não é o objetivo.
--
-- Reversibilidade: nada existente muda. Reverter é remover a função e a tabela, e o código que chama
-- (uma linha por rota; ele já segue adiante se a função falhar).

create table public.limites_de_taxa (
  chave text not null check (char_length(chave) between 3 and 200),
  janela timestamptz not null,
  contagem integer not null default 0 check (contagem >= 0),
  primary key (chave, janela)
);

-- Fechada a qualquer sessão: sem policy, só a chave de serviço (que ignora RLS) e funções DEFINER chegam.
alter table public.limites_de_taxa enable row level security;
revoke all on public.limites_de_taxa from public, anon, authenticated;

create index limites_de_taxa_por_janela on public.limites_de_taxa (janela);

create function public.limite_de_taxa_tentar(p_chave text, p_limite integer, p_janela_segundos integer)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  inicio timestamptz;
  atual integer;
begin
  if p_chave is null or char_length(p_chave) not between 3 and 200
     or p_limite is null or p_limite not between 1 and 100000
     or p_janela_segundos is null or p_janela_segundos not between 1 and 86400 then
    raise exception 'limite de taxa: parâmetros inválidos' using errcode = '22023';
  end if;

  inicio := to_timestamp(floor(extract(epoch from now()) / p_janela_segundos) * p_janela_segundos);

  insert into public.limites_de_taxa as l (chave, janela, contagem)
  values (p_chave, inicio, 1)
  on conflict (chave, janela) do update set contagem = l.contagem + 1
  returning l.contagem into atual;

  if random() < 0.02 then
    delete from public.limites_de_taxa where janela < now() - interval '2 days';
  end if;

  return atual <= p_limite;
end;
$$;

revoke all on function public.limite_de_taxa_tentar(text, integer, integer) from public, anon, authenticated;
grant execute on function public.limite_de_taxa_tentar(text, integer, integer) to service_role;
