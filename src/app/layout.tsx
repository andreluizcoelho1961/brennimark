import type { Metadata } from "next";
import { brandFont } from "@brand-font";
import { brandvilleInstance, brandvilleThemeStyle } from "@/brandville/config";
import "./globals.css";

export const metadata: Metadata = {
  title: brandvilleInstance.metadata.title,
  description: brandvilleInstance.metadata.description,
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang={brandvilleInstance.metadata.language}
      className={`${brandFont.variable} h-full antialiased`}
      style={brandvilleThemeStyle}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
