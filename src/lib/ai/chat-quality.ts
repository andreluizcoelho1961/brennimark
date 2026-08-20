const MODERATION_ONLY = [
  "user safety: safe",
  "user safety: unsafe",
  "assistant safety: safe",
  "assistant safety: unsafe",
];

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Some routed free models expose an internal moderation label instead of an
 * answer. Buffer only while the opening could still be one of those labels;
 * accept normal text immediately and reject a completed moderation-only reply.
 */
export function evaluateChatInitialText(text: string, streamEnded: boolean): "accept" | "continue" | "reject" {
  const normalized = normalize(text);
  if (!normalized) return streamEnded ? "reject" : "continue";
  if (MODERATION_ONLY.some((candidate) => candidate.startsWith(normalized))) {
    return streamEnded ? "reject" : "continue";
  }
  if (MODERATION_ONLY.some((candidate) => normalized.startsWith(candidate))) return "reject";
  return "accept";
}
