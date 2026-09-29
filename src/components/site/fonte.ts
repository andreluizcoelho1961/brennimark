import { Inter } from "next/font/google";

/**
 * A fonte do SITE: Inter, como no protótipo. A plataforma usa Inter Tight
 * (fatia 6); os dois convivem, cada um no seu lado da porta.
 *
 * O Next baixa o arquivo no build e o serve junto com o site: o navegador de
 * quem visita não chama o Google. O protótipo carregava do Google Fonts, o
 * que entregava o endereço de cada visitante a um terceiro.
 */
export const fonteDoSite = Inter({ subsets: ["latin"], variable: "--fonte-site", display: "swap" });
