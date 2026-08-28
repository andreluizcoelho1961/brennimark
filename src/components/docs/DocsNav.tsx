"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  brandvilleInstance,
  brandvilleUtilityLinks as UTILITY_LINKS,
} from "@/brandville/config";
import type { DocPageEntry } from "@/content/docs";
import { platformIdentity } from "@/platform/identity";

const GROUPS = brandvilleInstance.navigation.groups;
const GROUP_CODES = brandvilleInstance.navigation.groupCodes;

// The rail's overflow-y-auto forces overflow-x to compute as "auto" too
// (a CSS Overflow spec quirk — you can't mix visible/auto on one element),
// which clips any absolutely-positioned child that spills past the rail's
// edge. A portal positioned via getBoundingClientRect sidesteps that
// clipping entirely instead of fighting the container's overflow box.
function RailTooltip({ label, targetRef, show }: { label: string; targetRef: React.RefObject<HTMLElement | null>; show: boolean }) {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!show || !targetRef.current) {
      setCoords(null);
      return;
    }
    const rect = targetRef.current.getBoundingClientRect();
    setCoords({ top: rect.top + rect.height / 2, left: rect.right + 12 });
  }, [show, targetRef]);

  if (typeof document === "undefined" || !coords) return null;

  return createPortal(
    <span
      role="tooltip"
      style={{ top: coords.top, left: coords.left }}
      className="pointer-events-none fixed z-50 -translate-y-1/2 whitespace-nowrap border border-border-default bg-background-secondary px-2.5 py-1.5 font-display text-[10px] font-bold uppercase tracking-wide text-release-analog-white shadow-lg"
    >
      {label}
    </span>,
    document.body
  );
}

function RailItem({ label, children }: { label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  return (
    <div
      ref={ref}
      className="group relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      {children}
      <RailTooltip label={label} targetRef={ref} show={hovered} />
    </div>
  );
}

export function DocsNav({ docs: docsRegistry, isOwner = false }: { docs: DocPageEntry[]; isOwner?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isEnglish = brandvilleInstance.metadata.language === "en";
  const utilityLinks = useMemo(() => [
    ...UTILITY_LINKS,
    { href: "/docs/biblioteca", code: "AS", label: isEnglish ? "Asset library" : "Biblioteca de assets" },
    ...(isOwner ? [{ href: "/docs/admin", code: "AD", label: isEnglish ? `Manage ${platformIdentity.displayName}` : `Administrar ${platformIdentity.displayName}` }] : []),
  ], [isEnglish, isOwner]);

  const activeSlug = pathname?.replace(/^\/docs\//, "") ?? "";
  const activeEntry = docsRegistry.find((d) => d.slug === activeSlug);

  // Manual group selection (rail click) overrides the active page's
  // group until navigation changes — reset it during render (React's
  // recommended pattern for deriving state from a changed prop)
  // instead of a useEffect+setState round trip.
  const [manualGroup, setManualGroup] = useState<string | null>(null);
  const [lastActiveSlug, setLastActiveSlug] = useState(activeSlug);
  if (activeSlug !== lastActiveSlug) {
    setLastActiveSlug(activeSlug);
    setManualGroup(null);
  }
  const selectedGroup = manualGroup ?? activeEntry?.group ?? GROUPS[0];

  const [mobileOpenGroups, setMobileOpenGroups] = useState<Set<string>>(
    () => new Set(activeEntry ? [activeEntry.group] : [])
  );
  const [lastMobileSlug, setLastMobileSlug] = useState(activeSlug);
  if (activeSlug !== lastMobileSlug) {
    setLastMobileSlug(activeSlug);
    setMobileNavOpen(false);
  }

  function toggleMobileGroup(group: string) {
    setMobileOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }

  function closePalette() {
    setPaletteOpen(false);
    setQuery("");
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
      if (e.key === "Escape") {
        closePalette();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (paletteOpen) searchRef.current?.focus();
  }, [paletteOpen]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return docsRegistry
      .filter((d) => d.title.toLowerCase().includes(q) || d.group.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, docsRegistry]);

  function jumpTo(slug: string) {
    closePalette();
    router.push(`/docs/${slug}`);
  }

  function selectGroup(group: string) {
    setManualGroup(group);
    if (group !== activeEntry?.group) {
      const firstInGroup = docsRegistry.find((d) => d.group === group);
      if (firstInGroup) router.push(`/docs/${firstInGroup.slug}`);
    }
  }

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex h-14 flex-none items-center justify-between border-b border-border-default bg-background-primary px-4 md:hidden">
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          aria-label={isEnglish ? "Open menu" : "Abrir menu"}
          className="flex h-11 w-11 flex-col items-center justify-center gap-1 border border-border-default"
        >
          <span aria-hidden="true" className="h-px w-4 bg-release-analog-white" />
          <span aria-hidden="true" className="h-px w-4 bg-release-analog-white" />
          <span aria-hidden="true" className="h-px w-4 bg-release-analog-white" />
        </button>
        <Link href="/docs" className="font-display text-sm font-bold uppercase tracking-wider text-release-analog-white">
          {brandvilleInstance.brand.shortName} <span className="text-release-analog-turquoise">/ {platformIdentity.displayName}</span>
        </Link>
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          aria-label={isEnglish ? "Search" : "Buscar"}
          className="flex h-11 w-11 items-center justify-center border border-border-default text-text-secondary"
        >
          <span aria-hidden="true">⌕</span>
        </button>
      </div>

      {/* Mobile nav drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-scrim" onClick={() => setMobileNavOpen(false)} />
          <nav
            aria-label="Menu"
            className="absolute inset-y-0 left-0 flex w-[85vw] max-w-xs flex-col overflow-y-auto border-r border-border-default bg-background-primary py-6"
          >
            <div className="flex items-center justify-between px-5 pb-4">
              <span className="font-display text-sm font-bold uppercase tracking-wider text-release-analog-white">
                {brandvilleInstance.brand.shortName} <span className="text-release-analog-turquoise">/ {platformIdentity.displayName}</span>
              </span>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label={isEnglish ? "Close menu" : "Fechar menu"}
                className="flex h-11 w-11 items-center justify-center border border-border-default text-release-analog-white"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3">
              {GROUPS.map((group) => {
                const isOpen = mobileOpenGroups.has(group);
                return (
                  <div key={group} className="mb-1">
                    <button
                      type="button"
                      onClick={() => toggleMobileGroup(group)}
                      aria-expanded={isOpen}
                      className="flex min-h-11 w-full items-center justify-between px-2 py-2.5 font-display text-xs font-bold uppercase tracking-wide text-text-secondary hover:text-release-analog-white"
                    >
                      {group}
                      <span aria-hidden="true" className={`text-[10px] transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`}>
                        ⌄
                      </span>
                    </button>
                    {isOpen && (
                      <ul>
                        {docsRegistry
                          .filter((d) => d.group === group)
                          .map((page) => {
                            const isActive = page.slug === activeSlug;
                            return (
                              <li key={page.slug}>
                                <Link
                                  href={`/docs/${page.slug}`}
                                  aria-current={isActive ? "page" : undefined}
                                  className={`block min-h-11 px-4 py-3 text-sm transition-colors duration-150 ${
                                    isActive ? "text-release-analog-white" : "text-text-secondary hover:text-release-analog-white"
                                  }`}
                                >
                                  {page.title}
                                </Link>
                              </li>
                            );
                          })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex-none border-t border-border-default px-3 pt-4">
              {utilityLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`block min-h-11 px-2 py-3 font-display text-xs font-bold uppercase tracking-wide ${
                    pathname === link.href ? "text-release-analog-turquoise" : "text-text-secondary hover:text-release-analog-white"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </nav>
        </div>
      )}

      {/* Desktop rail + panel */}
      <div className="hidden h-full flex-none md:flex">
        {/* Rail */}
        <nav
          aria-label={isEnglish ? "Groups" : "Grupos"}
          className="flex w-16 flex-none flex-col items-center gap-6 overflow-y-auto border-r border-border-default bg-background-primary py-6"
        >
          <Link
            href="/docs"
            title={brandvilleInstance.metadata.title}
            className="font-display text-lg font-black text-release-analog-turquoise"
          >
            B
          </Link>

          <div className="mt-2 flex flex-col gap-3">
            {GROUPS.map((group) => {
              const isSelected = group === selectedGroup;
              const isActiveGroup = group === activeEntry?.group;
              return (
                <RailItem key={group} label={group}>
                  <button
                    type="button"
                    onClick={() => selectGroup(group)}
                    aria-pressed={isSelected}
                    aria-label={group}
                    className={`flex h-11 w-11 items-center justify-center border font-display text-[11px] font-bold uppercase transition-colors duration-150 ${
                      isSelected
                        ? "border-release-analog-turquoise bg-release-analog-turquoise text-release-analog-black"
                        : isActiveGroup
                          ? "border-release-analog-white text-release-analog-white"
                          : "border-border-default text-text-secondary hover:border-release-analog-white hover:text-release-analog-white"
                    }`}
                  >
                    {GROUP_CODES[group]}
                  </button>
                </RailItem>
              );
            })}
          </div>

          <div className="mt-auto flex flex-col gap-3">
            {utilityLinks.map((link) => (
              <RailItem key={link.href} label={link.label}>
                <Link
                  href={link.href}
                  aria-label={link.label}
                  className={`flex h-11 w-11 items-center justify-center border font-display text-[11px] font-bold uppercase transition-colors duration-150 ${
                    pathname === link.href || pathname?.startsWith(`${link.href}/`)
                      ? "border-release-analog-turquoise bg-release-analog-turquoise text-release-analog-black"
                      : "border-border-default text-text-secondary hover:border-release-analog-white hover:text-release-analog-white"
                  }`}
                >
                  {link.code}
                </Link>
              </RailItem>
            ))}
            <RailItem label={isEnglish ? "Search (⌘K)" : "Buscar (⌘K)"}>
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                aria-label={isEnglish ? "Search" : "Buscar"}
                className="flex h-11 w-11 items-center justify-center border border-border-default text-text-secondary transition-colors duration-150 hover:border-release-analog-white hover:text-release-analog-white"
              >
                <span aria-hidden="true">⌕</span>
              </button>
            </RailItem>
          </div>
        </nav>

        {/* Expanded panel for the selected group */}
        <aside
          className="brand-scrollbar flex w-64 flex-none flex-col overflow-y-auto border-r border-border-default bg-surface-primary py-8"
        >
          <p className="px-6 font-display text-[11px] font-bold uppercase tracking-[0.25em] text-release-analog-turquoise">
            {selectedGroup}
          </p>
          <ul className="mt-6">
            {docsRegistry
              .filter((d) => d.group === selectedGroup)
              .map((page) => {
                const isActive = page.slug === activeSlug;
                return (
                  <li key={page.slug}>
                    <Link
                      href={`/docs/${page.slug}`}
                      aria-current={isActive ? "page" : undefined}
                      className={`block min-h-11 px-6 py-3 font-display text-sm font-bold uppercase tracking-wide transition-colors duration-150 ${
                        isActive ? "text-release-analog-white" : "text-text-secondary hover:text-release-analog-white"
                      }`}
                    >
                      {page.title}
                    </Link>
                  </li>
                );
              })}
          </ul>
        </aside>
      </div>

      {/* Command palette */}
      {paletteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-scrim pt-32"
          onClick={closePalette}
        >
          <div
            className="w-full max-w-lg border border-border-default bg-surface-primary"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative border-b border-border-default">
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isEnglish ? "Search pages…" : "Buscar páginas…"}
                aria-label={isEnglish ? "Search pages" : "Buscar páginas"}
                className="w-full bg-transparent px-4 py-4 text-base text-release-analog-white placeholder:text-text-secondary focus:outline-none"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-mono text-[10px] text-text-secondary">
                ESC
              </span>
            </div>
            {results.length > 0 && (
              <ul className="max-h-80 overflow-y-auto">
                {results.map((r) => (
                  <li key={r.slug}>
                    <button
                      type="button"
                      onClick={() => jumpTo(r.slug)}
                      className="block w-full px-4 py-3 text-left text-sm text-release-analog-white hover:bg-surface-light"
                    >
                      <span className="block text-[10px] uppercase tracking-wide text-text-secondary">{r.group}</span>
                      {r.title}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {query.trim() && results.length === 0 && (
              <p className="px-4 py-4 text-sm text-text-secondary">{isEnglish ? "No results found." : "Nada encontrado."}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
