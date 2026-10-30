import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter, Space_Grotesk } from "next/font/google";
import { AdSlots } from "@/components/site/ads";
import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BLINDFOLD — Audio reactive sound system",
  description:
    "A blindfolded listening room: audio-reactive visuals, glass spectrum rails and an admin console for uploading tracks.",
  icons: { icon: "/brand/logo.png" },
  verification: {
    other: {
      "profiton-domain-verification": "776df637807e389cde960bf05aead208ac68a6802c11033517f28a0e5d89aa4d",
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#05080b",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body className="font-sans antialiased">
        {children}
        <AdSlots />
      </body>
    </html>
  );
}
