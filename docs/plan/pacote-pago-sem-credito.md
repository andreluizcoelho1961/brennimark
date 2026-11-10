# Pacote avulso pago e não creditado — o que fazer

Auditoria de 09/11/2026, item M1. Acontece quando o Stripe cobrou o pacote de perguntas, mas o banco
recusou o crédito (o caso conhecido: a conta está num plano sem franquia de perguntas, erro `22023`,
dica `pacote_sem_franquia`; ou o valor pago diverge do catálogo, ver B2).

## Como a equipe fica sabendo

1. **E-mail** para o endereço da empresa (`EMPRESA.email`) na PRIMEIRA falha do aviso, com sessão do
   Stripe, conta, pacote e motivo. As repetições do Stripe não mandam outro.
2. **Log** `cobranca_pacote_nao_creditado` (nível `error`) na Vercel.
3. **Console → Cobrança → "Pagamentos sem crédito"**: lista os avisos de checkout em `falhou`. Vazia é o
   estado normal. O campo "Detalhe" traz `sessao=cs_…`, `conta=<uuid>` e `pacote=<código>`.

## Conserto

O Stripe repete o aviso por até ~3 dias. Se a causa for corrigida nesse prazo (por exemplo, a conta
passa a um plano com franquia), o próximo aviso credita sozinho e a linha deixa de aparecer.

Se não puder esperar, ou se o motivo for divergência de valor:

- **Creditar à mão** (só depois de conferir no painel do Stripe que o pagamento existe e o valor está
  certo). No SQL editor do Supabase, com a chave de serviço, uma linha:

  ```sql
  select public.creditar_pacote_de_perguntas(
    '<conta>'::uuid, '<pacote>', <quantidade>, <valor_pago_em_centavos>, 'BRL', '<sessao cs_…>'
  );
  ```

  A função é idempotente pela sessão: rodar duas vezes não credita duas vezes. Ela recusa a conta sem
  franquia; nesse caso, ou ponha a conta em plano com franquia antes, ou estorne (abaixo).
- **Estornar** no painel do Stripe (Payments → o pagamento → Refund). Não há estorno automático.
- Depois do conserto, o aviso `falhou` continua no histórico até o Stripe repetir e o banco concluir; se
  não for repetir, deixe: o registro é o rastro da decisão.
