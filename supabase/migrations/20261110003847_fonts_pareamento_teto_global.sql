-- Teto global e limpeza em `solicitar_pareamento_fonts` (auditoria de 09/11/2026, M2).
--
-- O limite de 12 pedidos em 10 minutos usa `p_origem_hash`, e QUEM ENVIA O HASH É O CLIENTE: quem
-- varia o hash a cada pedido nunca bate o limite e enche `fonts_pareamentos_de_dispositivo` sem teto
-- (a função é executável por `anon`, por desenho: o desktop ainda não tem conta). Não vaza dado, mas
-- é crescimento ilimitado numa tabela que o produto usa de verdade.
--
-- O QUE MUDA (só o corpo da função; assinatura e privilégios iguais, `create or replace` os preserva)
--   - TETO GLOBAL: no máximo 300 pedidos por hora, somando todas as origens, independente do hash. A
--     recusa usa o mesmo SQLSTATE do limite por origem (`P0003`), para o servidor não precisar de caso novo;
--   - LIMPEZA: a cada pedido, apaga pareamentos que nunca foram aprovados e venceram há mais de 1 dia.
--     Aprovado ou revogado NUNCA é apagado aqui (é o registro dos dispositivos da conta). O índice
--     parcial `fonts_pareamentos_pendentes_idx` já cobre essa consulta.
--
-- Com 300/h e 1 dia de retenção, o teto de linhas pendentes é ~7.200, não infinito.
-- Reversibilidade: o corpo anterior está em `20261022161349_fonts_device_pairing.sql`; reverter é
-- recriar aquela versão. Nenhum dado existente muda.

create or replace function public.solicitar_pareamento_fonts(
  p_id uuid,
  p_token_hash text,
  p_segredo_hash text,
  p_origem_hash text,
  p_rotulo_do_dispositivo text
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  if p_token_hash !~ '^[0-9a-f]{64}$' or p_segredo_hash !~ '^[0-9a-f]{64}$' or p_origem_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'hash de pareamento inválido' using errcode = '22023';
  end if;
  if length(btrim(p_rotulo_do_dispositivo)) not between 1 and 80 or p_rotulo_do_dispositivo ~ '[[:cntrl:]]' then
    raise exception 'rótulo de dispositivo inválido' using errcode = '22023';
  end if;

  delete from public.fonts_pareamentos_de_dispositivo p
   where p.aprovado_em is null and p.revogado_em is null and p.expira_em < now() - interval '1 day';

  if (select count(*) from public.fonts_pareamentos_de_dispositivo p
      where p.criado_em > now() - interval '1 hour') >= 300 then
    raise exception 'limite temporário de pedidos de pareamento atingido' using errcode = 'P0003';
  end if;
  if (select count(*) from public.fonts_pareamentos_de_dispositivo p
      where p.origem_hash = p_origem_hash and p.criado_em > now() - interval '10 minutes') >= 12 then
    raise exception 'limite temporário de pedidos de pareamento atingido' using errcode = 'P0003';
  end if;
  insert into public.fonts_pareamentos_de_dispositivo (id, token_hash, segredo_hash, origem_hash, rotulo_do_dispositivo, expira_em)
  values (p_id, p_token_hash, p_segredo_hash, p_origem_hash, btrim(p_rotulo_do_dispositivo), now() + interval '10 minutes');
exception when unique_violation then
  raise exception 'pareamento já existe' using errcode = '23505';
end;
$$;
