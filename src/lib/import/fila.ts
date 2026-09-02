/**
 * A aritmética da fila de exclusão, separada do Supabase para ser contável.
 */

export interface PendenciaDeExclusao {
  id: string;
  storage_path: string;
  bucket_id: string;
  tentativas: number;
  ultima_tentativa_at: string | null;
  ultimo_erro?: string | null;
}

const MINUTO = 60_000;

/**
 * Quanto esperar antes de tentar de novo, pelo número de tentativas já feitas.
 *
 * Cresce e para de crescer. Cresce porque repetir a mesma falha a cada
 * abertura da administração gasta uma chamada ao Storage para obter o mesmo
 * resultado. Para de crescer porque uma falha pode ser transitória — o Storage
 * fora do ar por uma hora — e uma espera que dobrasse indefinidamente faria o
 * arquivo esperar dias depois que o problema já passou.
 *
 * A primeira tentativa é imediata: a maioria das exclusões funciona, e cobrar
 * espera de todas para punir as poucas que falham seria o troco errado.
 */
export function intervaloDeEspera(tentativas: number): number {
  if (tentativas <= 0) return 0;
  return Math.min(2 ** (tentativas - 1) * MINUTO, 60 * MINUTO);
}
