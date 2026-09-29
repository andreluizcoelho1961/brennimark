"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * O que o site faz no navegador, em qualquer página: menus do cabeçalho, menu
 * do celular, o diálogo de contato, o botão de copiar, os blocos que sobem ao
 * aparecer, as formas ao fundo em profundidade, o selo que sai de cena perto
 * da chamada e o vídeo do Vini, que só carrega quando o capítulo chega perto.
 *
 * Portado do script do protótipo (29/09/2026) quase linha a linha, com duas
 * mudanças de forma, não de efeito:
 *
 * - tudo o que liga, desliga ao sair (`AbortController`, `disconnect`), e cada
 *   passo pode rodar duas vezes sem dobrar nada — o React monta, desmonta e
 *   remonta os efeitos em desenvolvimento, e a navegação entre páginas do site
 *   roda tudo de novo sobre a página nova;
 * - a marcação vem pronta do servidor (títulos já em palavras, formas ao fundo
 *   já no lugar); aqui só se liga comportamento.
 *
 * O trilho de capítulos da home é outro componente (`TrilhoDaHome`).
 */

/** A mesma lista do CSS (`site.css`, busca por "REVELADOS"). */
const REVELADOS = [
  ".points>div", ".feat-row>*", ".stp", ".rel", ".sc", ".big-quote", ".faq details", ".log-e", ".pains>div",
  ".two-apps>div", ".s3", ".mani-body>p", ".cta-band>*", ".hsearch", ".quote", ".plan", ".step", ".traits li",
  ".ai-list li", ".aud", ".ficha div", ".lives .st", ".tags span", ".pg-lead", ".pg-actions", ".crumb", ".intro",
  ".honest", ".more", ".fidelity", ".chat", ".dna-pair>*", ".frame", ".stage",
].join(",");

/** O Safari só lê o vídeo com transparência em HEVC; os demais, em WebM. */
const SAFARI = /^((?!chrome|chromium|android|crios|fxios|edg).)*safari/i;

export function ComportamentoDoSite() {
  const caminho = usePathname();

  useEffect(() => {
    const raiz = document.querySelector<HTMLElement>(".bm-site");
    if (!raiz) return;
    const html = document.documentElement;
    const fim = new AbortController();
    const { signal } = fim;
    const observadores: IntersectionObserver[] = [];
    const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // O script da moldura ligou o movimento antes da primeira pintura; aqui se
    // confirma que o JavaScript chegou, para a salvaguarda dele não desligar.
    html.setAttribute("data-site-vivo", "");
    if (!reduzido) html.setAttribute("data-site-movimento", "");

    // ---------- menus do cabeçalho ----------
    const botoes = [...raiz.querySelectorAll<HTMLButtonElement>(".nav-btn")];
    const menuDe = (b: HTMLButtonElement) => document.getElementById(b.getAttribute("aria-controls") ?? "");
    const temHover = () => window.matchMedia("(hover:hover)").matches;
    const fecharMenus = (exceto?: HTMLButtonElement) => {
      for (const b of botoes) {
        if (b === exceto) continue;
        b.setAttribute("aria-expanded", "false");
        menuDe(b)?.classList.remove("open");
      }
    };
    for (const b of botoes) {
      const menu = menuDe(b);
      const item = b.parentElement;
      if (!menu || !item) continue;
      let espera = 0;
      b.addEventListener(
        "click",
        () => {
          const aberto = b.getAttribute("aria-expanded") === "true";
          const abrir = temHover() ? true : !aberto;
          fecharMenus(b);
          b.setAttribute("aria-expanded", String(abrir));
          menu.classList.toggle("open", abrir);
        },
        { signal },
      );
      item.addEventListener(
        "mouseenter",
        () => {
          window.clearTimeout(espera);
          if (!temHover()) return;
          fecharMenus(b);
          b.setAttribute("aria-expanded", "true");
          menu.classList.add("open");
        },
        { signal },
      );
      item.addEventListener(
        "mouseleave",
        () => {
          if (!temHover()) return;
          espera = window.setTimeout(() => {
            b.setAttribute("aria-expanded", "false");
            menu.classList.remove("open");
          }, 220);
        },
        { signal },
      );
    }

    // ---------- menu do celular ----------
    const alternador = raiz.querySelector<HTMLButtonElement>(".menu-toggle");
    const mnav = raiz.querySelector<HTMLElement>("#mnav");
    const menuDoCelular = (aberto: boolean) => {
      if (!alternador || !mnav) return;
      alternador.setAttribute("aria-expanded", String(aberto));
      mnav.hidden = !aberto;
      raiz.classList.toggle("mnav-open", aberto);
    };
    menuDoCelular(false);
    alternador?.addEventListener("click", () => menuDoCelular(!!mnav?.hidden), { signal });
    mnav?.addEventListener(
      "click",
      (e) => {
        if ((e.target as Element).closest("a,button")) menuDoCelular(false);
      },
      { signal },
    );
    const telaMedia = window.matchMedia("(max-width: 1023px)");
    telaMedia.addEventListener("change", () => !telaMedia.matches && menuDoCelular(false), { signal });

    document.addEventListener(
      "keydown",
      (e) => {
        if (e.key !== "Escape") return;
        fecharMenus();
        if (mnav && !mnav.hidden) menuDoCelular(false);
      },
      { signal },
    );

    // ---------- cliques: fora do menu, abrir e fechar diálogos ----------
    document.addEventListener(
      "click",
      (e) => {
        const alvo = e.target as Element;
        // A migalha "Plataforma · …" abre o menu do cabeçalho em vez de navegar.
        const migalha = alvo.closest<HTMLElement>("[data-open-menu]");
        if (migalha) {
          e.preventDefault();
          window.scrollTo(0, 0);
          const botao = botoes.find((b) => b.getAttribute("aria-controls") === migalha.dataset.openMenu);
          if (botao) {
            fecharMenus(botao);
            botao.setAttribute("aria-expanded", "true");
            menuDe(botao)?.classList.add("open");
          }
          return;
        }
        if (!alvo.closest(".nav-item")) fecharMenus();
        const abre = alvo.closest<HTMLElement>("[data-open]");
        if (abre) {
          const dialogo = document.getElementById(abre.dataset.open ?? "");
          if (dialogo instanceof HTMLDialogElement && !dialogo.open) dialogo.showModal();
          return;
        }
        alvo.closest("[data-close]")?.closest("dialog")?.close();
      },
      { signal },
    );
    for (const dialogo of raiz.querySelectorAll("dialog")) {
      // Clique no fundo escurecido fecha: o alvo é o próprio <dialog>.
      dialogo.addEventListener("click", (e) => e.target === dialogo && dialogo.close(), { signal });
    }

    // ---------- copiar o prompt ----------
    for (const botao of raiz.querySelectorAll<HTMLButtonElement>(".copy")) {
      botao.addEventListener(
        "click",
        () => {
          const origem = document.querySelector(botao.dataset.copy ?? "");
          if (!origem) return;
          const copia = origem.cloneNode(true) as Element;
          copia.querySelectorAll(".ref").forEach((r) => r.remove());
          const texto = (copia.textContent ?? "").replace(/[ \t]+$/gm, "");
          const ok = () => {
            botao.textContent = "Copiado";
            window.setTimeout(() => (botao.textContent = "Copiar"), 1600);
          };
          const selecionar = () => {
            const faixa = document.createRange();
            faixa.selectNodeContents(origem);
            const sel = getSelection();
            sel?.removeAllRanges();
            sel?.addRange(faixa);
          };
          if (navigator.clipboard) navigator.clipboard.writeText(texto).then(ok, selecionar);
          else selecionar();
        },
        { signal },
      );
    }

    // ---------- o vídeo do Vini: só carrega quando o capítulo chega perto ----------
    const video = raiz.querySelector<HTMLVideoElement>("#vini-video");
    if (video && !reduzido) {
      const io = new IntersectionObserver(
        (entradas) => {
          if (!entradas.some((e) => e.isIntersecting)) return;
          io.disconnect();
          if (video.getAttribute("src")) return;
          video.src = SAFARI.test(navigator.userAgent) ? (video.dataset.mov ?? "") : (video.dataset.webm ?? "");
          video.play().catch(() => {});
        },
        { rootMargin: "50% 0px" },
      );
      io.observe(video);
      observadores.push(io);
    }

    // ---------- selo de fogo: sai de cena onde já há a chamada para a demonstração ----------
    const faixas = [...raiz.querySelectorAll<HTMLElement>(".cta-band")];
    if (faixas.length) {
      const io = new IntersectionObserver(() => {
        const alguma = faixas.some((c) => {
          const r = c.getBoundingClientRect();
          return c.offsetParent !== null && r.top < innerHeight && r.bottom > 0;
        });
        raiz.classList.toggle("stamp-off-page", alguma);
      });
      faixas.forEach((c) => io.observe(c));
      observadores.push(io);
    }

    if (!reduzido) {
      // ---------- blocos que sobem, em cascata dentro de cada grupo ----------
      const alvos = new Set<Element>();
      for (const el of raiz.querySelectorAll<HTMLElement>(REVELADOS)) {
        if (el.parentElement?.closest(REVELADOS)) continue; // o CSS também pula os de dentro
        const irmao = [...(el.parentElement?.children ?? [])].indexOf(el);
        el.style.setProperty("--d", `${Math.min(irmao, 6) * 90}ms`);
        alvos.add(el);
      }
      raiz.querySelectorAll(".split").forEach((el) => alvos.add(el));
      const io = new IntersectionObserver(
        (entradas) =>
          entradas.forEach((en) => {
            if (!en.isIntersecting) return;
            en.target.classList.add("in");
            io.unobserve(en.target);
          }),
        { rootMargin: "0px 0px -6% 0px", threshold: 0.01 },
      );
      alvos.forEach((el) => io.observe(el));
      observadores.push(io);

      // ---------- profundidade: as formas andam num ritmo diferente do conteúdo ----------
      const formas = [...raiz.querySelectorAll<HTMLElement>(".loz")];
      let agendado = false;
      const mover = () => {
        agendado = false;
        const vw = innerWidth;
        const vh = innerHeight;
        for (const forma of formas) {
          const dono = forma.parentElement;
          if (!dono || (!dono.offsetParent && !dono.classList.contains("panel"))) continue;
          const r = dono.getBoundingClientRect();
          if (r.bottom < -200 || r.top > vh + 200 || r.right < -200 || r.left > vw + 200) continue;
          const v = Number(forma.dataset.speed);
          const dy = (r.top + r.height / 2 - vh / 2) * v;
          const dx = (r.left + r.width / 2 - vw / 2) * v;
          forma.style.transform = `translate3d(${dx.toFixed(1)}px,${dy.toFixed(1)}px,0) rotate(${(dy * 0.02 + dx * 0.02).toFixed(2)}deg)`;
        }
      };
      const pedir = () => {
        if (agendado) return;
        agendado = true;
        requestAnimationFrame(mover);
      };
      window.addEventListener("scroll", pedir, { passive: true, signal });
      window.addEventListener("resize", pedir, { signal });
      // O trilho da home rola na horizontal, dentro de si; a captura pega esse rolar também.
      document.addEventListener("scroll", pedir, { passive: true, capture: true, signal });
      pedir();
    }

    return () => {
      fim.abort();
      observadores.forEach((o) => o.disconnect());
      html.removeAttribute("data-site-vivo");
      html.removeAttribute("data-site-movimento");
    };
  }, [caminho]);

  return null;
}
