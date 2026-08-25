import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://reallioo.com"),
  title: "Reallioo — Imagine. Écris. Ça devient réel.",
  description: "Transforme tes photos avec l’IA : change une voiture, un décor, une tenue ou une scène à partir de tes propres références.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "Reallioo — Imagine. Écris. Ça devient réel.",
    description: "Transforme tes photos avec l’IA à partir de tes propres images et références.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Reallioo — création de photos par IA" }],
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Reallioo — Imagine. Écris. Ça devient réel.",
    description: "Transforme tes photos avec l’IA à partir de tes propres images et références.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr"><body>{children}</body></html>;
}
