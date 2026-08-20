import path from "node:path";
import type { NextConfig } from "next";

/**
 * Each brand's licensed font files must only ever be emitted into that
 * brand's own bundle. next/font/local emits every localFont() call it finds
 * in the module graph, so the active instance picks its font module here
 * instead of the layout importing all of them.
 *
 * To give an instance its own typeface: add `src/fonts/<brand>.ts` exporting
 * `brandFont`, then map the instance key to it below.
 */
const fontModuleByInstance: Record<string, string> = {};

const activeInstance = process.env.NEXT_PUBLIC_BRANDVILLE_INSTANCE ?? "the-bluesmaker";
// Turbopack resolves the alias as a project-relative specifier; webpack needs an absolute path.
const relativeFontModule = fontModuleByInstance[activeInstance] ?? "./src/fonts/gotham.ts";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: { "@brand-font": relativeFontModule },
  },
  webpack: (config) => {
    config.resolve.alias = { ...config.resolve.alias, "@brand-font": path.resolve(relativeFontModule) };
    return config;
  },
};

export default nextConfig;
