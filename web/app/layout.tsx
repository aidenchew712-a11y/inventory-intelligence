import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  title: { default: "Stockroom — Supply Chain & Inventory Intelligence", template: "%s | Stockroom" },
  description: "A clear view of your inventory, suppliers, and stock health. Built for small businesses, with private workspaces and practical reporting.",
  openGraph: { type: "website", siteName: "Stockroom", title: "Stockroom — A clearer view of your inventory", description: "Less guesswork. Better stock decisions.", images: [{ url: "/opengraph-image", width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image" },
  icons: { icon: "/icon.svg" },
};
export default function RootLayout({ children }: { children: ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
