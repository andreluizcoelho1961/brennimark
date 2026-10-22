import type { CSSProperties, ReactNode } from "react";

/**
 * A moldura da ferramenta em janela solta (21/10/2026): só a barra fina da
 * janela, sem o menu do site. A altura da barra (44 px) vai em `--shell-topbar`,
 * de onde as telas das ferramentas tiram a própria altura.
 */
const ALTURA_DA_BARRA = "44px";

export default function LayoutDaJanela({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-h-dvh bg-platform-bg text-platform-text"
      style={{ paddingTop: ALTURA_DA_BARRA, "--shell-topbar": ALTURA_DA_BARRA } as CSSProperties}
    >
      <main>{children}</main>
    </div>
  );
}
