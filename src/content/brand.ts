export interface ColorToken {
  name: string;
  token: string;
  hex: string;
  function: string;
}

/**
 * The permanent brand palette. Black and white ARE the brand colors —
 * they carry across every release and never change. See the two-layer
 * model in docs/BRANDBOOK_PENDING_DECISIONS.md.
 */
export const foundationColorTokens: ColorToken[] = [
  { name: "Foundation", token: "--color-primitive-black", hex: "#000000", function: "Structural anchor — primary background. Permanent." },
  { name: "Voice", token: "--color-primitive-white", hex: "#F6F2EF", function: "Primary text, wordmark. A warm off-white, not pure #fff. Permanent." },
  { name: "Neutral", token: "--color-primitive-gray", hex: "#9AA3AD", function: "Secondary text, muted labels. Permanent." },
];

/**
 * Release-specific accents. Each single may carry its own colors,
 * sampled from that release's own artwork — these belong to
 * "Call Me Analog Man" and must not be treated as brand colors.
 */
export const releaseAccentTokens: ColorToken[] = [
  { name: "Accent — Turquoise", token: "--color-release-analog-turquoise", hex: "#01A48F", function: "Primary emphasis for this release — sampled from the Call Me Analog Man cover." },
  { name: "Accent — Blue", token: "--color-release-analog-blue", hex: "#3AA6D4", function: "Secondary emphasis for this release — sampled from the same cover." },
  { name: "Echo", token: "--color-primitive-cyan", hex: "#2EE6C8", function: "UI-only accent (focus rings, small highlights) — derived from this release's turquoise, never a brand color." },
];

/** Every documented color, foundation first. */
export const colorTokens: ColorToken[] = [...foundationColorTokens, ...releaseAccentTokens];

export interface TypeRole {
  name: string;
  weight: string;
  usage: string;
  sample: string;
}

export const typeRoles: TypeRole[] = [
  { name: "Display", weight: "Gotham Black (900)", usage: "Hero titles, oversized editorial statements. Uppercase, tight tracking.", sample: "CALL ME ANALOG MAN" },
  { name: "Heading", weight: "Gotham Bold (700)", usage: "Section headings, primary CTAs.", sample: "Official Video" },
  { name: "Label", weight: "Gotham Bold (700)", usage: "Kickers, metadata, small caps labels.", sample: "NEW SINGLE" },
  { name: "Body", weight: "Gotham Book (400)", usage: "Paragraph copy, long-form reading.", sample: "Call Me Analog Man is about remaining human in a world increasingly mediated by technology." },
  { name: "Medium", weight: "Gotham Medium (500)", usage: "Credits, secondary emphasis within body copy.", sample: "Produced by André Coelho" },
];

export const motionSpec = {
  durations: [
    { name: "motion-fast", value: "150ms", usage: "Hover, CTA state transitions." },
    { name: "motion-standard", value: "300ms", usage: "Section transitions." },
    { name: "motion-slow", value: "600ms", usage: "Larger reveals." },
    { name: "motion-editorial", value: "900ms", usage: "Full-section entrance moments." },
  ],
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
  /** The movement vocabulary — motion that reveals hierarchy. */
  inVocabulary: [
    "Text reveal",
    "Image reveal",
    "Section transition",
    "Link hover",
    "CTA state transition",
    "Subtle mask movement",
    "Controlled color/contrast change",
    "Sticky header transitions",
  ],
  /** Motion that performs on its own account — it becomes the subject. */
  outsideVocabulary: [
    "Autoplay hero video",
    "Carousels",
    "Particle systems",
    "Animated noise",
    "Fake film damage",
    "Decorative waveforms",
    "Random glitch effects",
    "Excessive scroll choreography",
  ],
};

export const photographyDirection = {
  /** What the photography looks for. */
  lookFor: [
    "Editorial portraiture, high contrast",
    "Directional, cool lighting",
    "Concentrated, serious expression",
    "Real skin and physical texture",
    "Monochrome/duotone or controlled analog-film color",
    "Restrained styling",
    "Strong presence without rock-star posturing",
  ],
  /** What pulls the image toward genre illustration instead. */
  pullsAway: [
    "Hat as automatic bluesman signifier",
    "Smoke",
    "Generic dark-bar imagery",
    "Route 66 / highway clichés",
    "Amps and tubes used as decoration",
    "Dominant amber lighting",
    "HDR / exaggerated fake grain",
    "Orange-and-teal cinematic grading",
    "Obvious AI artifacts or glossy AI portrait treatment",
    "Cyberpunk styling",
    "Sentimental retro filters",
  ],
};

export const voice = {
  characteristics: [
    "Concise",
    "Direct",
    "Elegant",
    "Adult",
    "Observant",
    "Slightly ironic when appropriate",
    "Free from marketing inflation",
  ],
  /** Language that promises instead of showing. */
  outsideVocabulary: [
    "Revolutionary",
    "Groundbreaking",
    "Legendary",
    "Unique experience",
    "Passion-driven",
    "Authentic journey",
    "“Where analog meets digital”",
    "“A journey through time”",
    "Corporate branding jargon",
    "Verbose AI-generated copy",
  ],
  languageRules: [
    "English is canonical: artist name, release titles, lyrics, interface labels, release metadata, CTAs, credits, audiovisual titles.",
    "Lyrics stay in their original language in the main artistic presentation — a translation belongs in a contextual essay, not over the song itself.",
    "Portuguese is used for: local press materials, institutional/cultural communication in Brazil, booking info, accessibility support, contextual essays for Brazilian audiences, legally/commercially necessary information.",
    "Each page or section holds one defined language — mixing the two inside the same editorial block reads as an accident rather than a choice.",
  ],
};

export const brandPositioning = {
  name: "The BluesMaker",
  oneLiner: "A contemporary blues artist project — direct, editorial, human.",
  description:
    "The BluesMaker's public-facing brand is exclusively about the music: songs, releases, official videos, lyrics, credits, streaming, live performances and artist communication. The interface exists to amplify the music, never to compete with it.",
  tone: [
    "Contemporary",
    "Editorial",
    "Urban",
    "Elegant",
    "Direct",
    "Musical",
    "Authorial",
    "Precise",
    "Human",
  ],
  notThis: [
    "A design studio",
    "A design methodology",
    "A technology project",
    "An AI experiment",
    "A visual-system laboratory",
  ],
};

export const dontResemble = [
  "A SaaS landing page",
  "A design portfolio",
  "An AI showcase",
  "A generic blues template",
  "A retro music website",
  "A corporate artist page",
  "A collection of fashionable effects",
];

export interface BrandAsset {
  id: string;
  label: string;
  href?: string;
  status: "available" | "restricted" | "pending";
  category: "artwork" | "photography" | "logo" | "font" | "iconography";
  description: string;
}

/** Official files that the guide can name, locate and explain. */
export const brandAssets: BrandAsset[] = [
  {
    id: "cover-call-me-analog-man",
    label: "Single cover (JPG)",
    href: "/artwork/call-me-analog-man-cover.jpg",
    status: "available",
    category: "artwork",
    description: "Official cover artwork for Call Me Analog Man.",
  },
  {
    id: "portrait-duotone",
    label: "Portrait — duotone (PNG)",
    href: "/images/portrait-duotone.png",
    status: "available",
    category: "photography",
    description: "Campaign portrait treated with the Call Me Analog Man duotone.",
  },
  {
    id: "wordmark-horizontal-white",
    label: "Wordmark — horizontal (PNG, white)",
    href: "/logo/logo-wordmark-horizontal-white.png",
    status: "available",
    category: "logo",
    description: "White horizontal wordmark for dark backgrounds.",
  },
  {
    id: "wordmark-stacked-right-white",
    label: "Wordmark — stacked right (PNG, white)",
    href: "/logo/logo-wordmark-stacked-right-white.png",
    status: "available",
    category: "logo",
    description: "White stacked-right wordmark for dark backgrounds.",
  },
  {
    id: "wordmark-stacked-left-white",
    label: "Wordmark — stacked left (PNG, white)",
    href: "/logo/logo-wordmark-stacked-left-white.png",
    status: "available",
    category: "logo",
    description: "White stacked-left wordmark for dark backgrounds.",
  },
  {
    id: "wordmark-vector-master",
    label: "Vector master (AI, all three)",
    href: "/brand/logos/THE-BLUESMAKER-LOGO.ai",
    status: "available",
    category: "logo",
    description: "Editable vector master containing all three official lockups.",
  },
  {
    id: "gotham-font-files",
    label: "Gotham font files",
    status: "restricted",
    category: "font",
    description: "Licensed files. Contact the studio; they must not be redistributed from the guide.",
  },
  {
    id: "music-icons-vector-master",
    label: "Music icons — vector master (AI)",
    href: "/brand/iconografia/Music-Icons.ai",
    status: "available",
    category: "iconography",
    description: "Editable master for the official 100-icon line set.",
  },
];

export interface LogoLockup {
  key: string;
  name: string;
  src: string;
  srcBlack: string;
  width: number;
  height: number;
  capHeight: number;
  use: string;
}

export const logoLockups: LogoLockup[] = [
  {
    key: "horizontal",
    name: "Horizontal",
    src: "/logo/logo-wordmark-horizontal-white.png",
    srcBlack: "/logo/logo-wordmark-horizontal-black.png",
    width: 3468,
    height: 280,
    capHeight: 280,
    use: "Default. Wide, shallow spaces — site headers, footers, banners, anywhere the mark sits in a single line of interface.",
  },
  {
    key: "stacked-right",
    name: "Stacked — stepping right",
    src: "/logo/logo-wordmark-stacked-right-white.png",
    srcBlack: "/logo/logo-wordmark-stacked-right-black.png",
    width: 1545,
    height: 975,
    capHeight: 305,
    use: "Square-ish and vertical spaces — social avatars, posters, merch. The step down to the right echoes the cover's CALL ME / ANALOG / MAN setting.",
  },
  {
    key: "stacked-left",
    name: "Stacked — stepping left",
    src: "/logo/logo-wordmark-stacked-left-white.png",
    srcBlack: "/logo/logo-wordmark-stacked-left-black.png",
    width: 1545,
    height: 976,
    capHeight: 306,
    use: "The mirror of the above, for when the composition leans the other way — artwork weighted to the right, or a left-hand page edge.",
  },
];

export const logoUsageRules = [
  {
    title: "Use it as drawn",
    body: "The lockups carry spacing decided letter by letter. Retyping the name in Gotham gets close but not right — the gaps come out even where the drawing tightens them. Place the supplied file rather than rebuilding the mark.",
  },
  {
    title: "Scale it proportionally",
    body: "Stretching or condensing changes the relationship between stroke weight and counter, which is what makes the mark read as this mark. Scale both axes together.",
  },
  {
    title: "Keep it monochrome",
    body: "White on dark, black on light — nothing else. Colour in this system belongs to the release, and a coloured mark would compete with the accent it sits next to instead of anchoring it.",
  },
  {
    title: "Let it sit flat",
    body: "No shadow, glow, outline, gradient or bevel. The whole visual system is flat and editorial; an effect on the mark is the one place it would read as decoration.",
  },
  {
    title: "Give it honest contrast",
    body: "Over photography, place it where the image is quiet and dark enough to hold white type. If the picture is busy under the mark, move the mark rather than adding a scrim to force it.",
  },
];

export const streamingLogos = [
  "spotify",
  "apple-music",
  "youtube-music",
  "amazon-music",
  "deezer",
  "tidal",
  "soundcloud",
];

export interface IconGroup {
  key: string;
  label: string;
  count: number;
  note: string;
}

export const iconGroups: IconGroup[] = [
  { key: "controls", label: "Transport & controls", count: 18, note: "Play, pause, record, skip, sliders, equalisers. The functional core — these are the ones an interface actually needs." },
  { key: "volume", label: "Volume", count: 7, note: "Speaker states from silent to loud." },
  { key: "playback", label: "Playback modes", count: 7, note: "Repeat, shuffle, loop." },
  { key: "notes", label: "Notation", count: 7, note: "Musical notes and note groupings." },
  { key: "instruments", label: "Instruments", count: 18, note: "Guitars, drums, brass, strings, keys." },
  { key: "mics", label: "Microphones", count: 18, note: "Handheld, stand-mounted, studio condensers." },
  { key: "devices", label: "Devices & formats", count: 18, note: "Turntables, vinyl, cassette, monitors, gramophone." },
  { key: "headphones", label: "Headphones", count: 7, note: "Over-ear, in-ear, earbuds." },
];

export const photographyGallery = [
  { src: "/images/photography/portrait-eyes-closed.jpg", alt: "The BluesMaker, eyes closed mid-phrase, playing guitar" },
  { src: "/images/photography/portrait-head-back.jpg", alt: "The BluesMaker, head back, singing" },
  { src: "/images/photography/portrait-spotlight.jpg", alt: "The BluesMaker under a single overhead spotlight" },
  { src: "/images/photography/portrait-profile.jpg", alt: "The BluesMaker in profile, playing guitar" },
  { src: "/images/photography/portrait-head-down.jpg", alt: "The BluesMaker, head down over the guitar" },
  { src: "/images/photography/portrait-low-angle.jpg", alt: "The BluesMaker seen from a low angle, guitar raised" },
  { src: "/images/photography/overhead-wide.jpg", alt: "The BluesMaker seen from above, head bowed over the guitar", wide: true },
];
