"use client";

import { useEffect, useState } from "react";
import { comAlvo, useAlvo } from "@/platform/alvo-client";
import type { CorDaMarca } from "@/lib/cores/cores";
import { Cores } from "./Cores";

/**
 * O Cores do assinante (10/10/2026): o mesmo Cores, com a paleta da marca
 * aberta — "é a cor da marca?" liga sozinho, porque a pessoa veio de dentro
 * de uma marca (especificação v2.2, §1½).
 */
export function CoresDoAssinante() {
  const alvo = useAlvo();
  const [dados, setDados] = useState<{ marca: string; paleta: CorDaMarca[] } | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const r = await fetch(comAlvo("/api/cores/paleta", alvo), { cache: "no-store" }).catch(() => null);
      const corpo = r ? await r.json().catch(() => ({})) : {};
      if (cancelado) return;
      if (r?.ok) setDados(corpo);
      else setErro(corpo.message ?? "Não foi possível ler a paleta agora.");
    })();
    return () => { cancelado = true; };
  }, [alvo]);

  if (erro) return <p role="alert" className="m-6 text-sm text-platform-text">{erro}</p>;
  if (!dados) return <p className="m-6 text-sm text-platform-text-muted">Abrindo as cores da marca…</p>;
  const base = alvo.workspaceSlug && alvo.brandKey ? `/w/${alvo.workspaceSlug}/b/${alvo.brandKey}/docs` : "/docs";
  return <Cores marca={{ nome: dados.marca, paleta: dados.paleta, linkDaPagina: (p) => `${base}/original?pagina=${p}` }} />;
}
