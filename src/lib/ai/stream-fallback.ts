import { brandvilleInstance } from "../../brandville/config";

const isEnglish = brandvilleInstance.metadata.language === "en";

export class FirstChunkTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(isEnglish ? `The provider didn't start responding within ${timeoutMs}ms.` : `O provedor não iniciou a resposta em ${timeoutMs}ms.`);
    this.name = "FirstChunkTimeoutError";
  }
}

export type PreparedFallbackStream<TAttempt> = {
  attempt: TAttempt;
  fallbackUsed: boolean;
  firstChunk: string;
  iterator: AsyncIterator<string>;
  cancel: (reason?: unknown) => void;
  cleanup: () => void;
};

type PrepareFallbackOptions<TAttempt> = {
  attempts: TAttempt[];
  firstChunkTimeoutMs: number;
  parentSignal?: AbortSignal;
  start: (attempt: TAttempt, signal: AbortSignal) => AsyncIterable<string> | Promise<AsyncIterable<string>>;
  onAttemptStart?: (attempt: TAttempt, index: number) => void;
  onAttemptFailure?: (attempt: TAttempt, index: number, error: unknown) => void;
  validateInitialText?: (text: string, streamEnded: boolean) => "accept" | "continue" | "reject";
};

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException(isEnglish ? "The request was aborted." : "A requisição foi interrompida.", "AbortError");
}

/**
 * Chooses a provider before any response text is exposed to the user.
 * This is the safe fallback boundary: once the first chunk exists, the
 * selected stream remains authoritative and is never mixed with another.
 */
export async function prepareStreamWithFallback<TAttempt>({
  attempts,
  firstChunkTimeoutMs,
  parentSignal,
  start,
  onAttemptStart,
  onAttemptFailure,
  validateInitialText,
}: PrepareFallbackOptions<TAttempt>): Promise<PreparedFallbackStream<TAttempt>> {
  if (attempts.length === 0) throw new Error(isEnglish ? "No AI route was configured." : "Nenhuma rota de IA foi configurada.");

  const errors: unknown[] = [];

  for (const [index, attempt] of attempts.entries()) {
    if (parentSignal?.aborted) throw abortReason(parentSignal);
    onAttemptStart?.(attempt, index);

    const attemptController = new AbortController();
    const abortFromParent = () => attemptController.abort(parentSignal ? abortReason(parentSignal) : undefined);
    parentSignal?.addEventListener("abort", abortFromParent, { once: true });

    let iterator: AsyncIterator<string> | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      parentSignal?.removeEventListener("abort", abortFromParent);
    };

    try {
      const iterable = await start(attempt, attemptController.signal);
      iterator = iterable[Symbol.asyncIterator]();

      const timeout = new Promise<never>((_resolve, reject) => {
        timeoutId = setTimeout(() => {
          const error = new FirstChunkTimeoutError(firstChunkTimeoutMs);
          attemptController.abort(error);
          reject(error);
        }, firstChunkTimeoutMs);
      });

      const first = await Promise.race([iterator.next(), timeout]);
      if (first.done || !first.value) throw new Error(isEnglish ? "The provider ended without starting a response." : "O provedor encerrou sem iniciar uma resposta.");
      if (timeoutId) clearTimeout(timeoutId);

      let initialText = first.value;
      if (validateInitialText) {
        let decision = validateInitialText(initialText, false);
        while (decision === "continue") {
          const next = await iterator.next();
          if (next.done) {
            decision = validateInitialText(initialText, true);
            break;
          }
          initialText += next.value;
          decision = validateInitialText(initialText, false);
        }
        if (decision === "reject" || decision === "continue") {
          throw new Error(isEnglish ? "The model returned only a moderation label without answering the question." : "O modelo retornou apenas um rótulo de moderação, sem responder à pergunta.");
        }
      }

      return {
        attempt,
        fallbackUsed: index > 0,
        firstChunk: initialText,
        iterator,
        cancel: (reason) => attemptController.abort(reason),
        cleanup,
      };
    } catch (error) {
      cleanup();
      attemptController.abort(error);
      if (iterator?.return) void Promise.resolve(iterator.return()).catch(() => undefined);
      if (parentSignal?.aborted) throw abortReason(parentSignal);
      errors.push(error);
      onAttemptFailure?.(attempt, index, error);
    }
  }

  throw new AggregateError(errors, isEnglish ? "All AI routes failed before starting a response." : "Todas as rotas de IA falharam antes de iniciar a resposta.");
}
