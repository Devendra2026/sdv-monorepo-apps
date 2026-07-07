import { Geist, JetBrains_Mono, Noto_Sans_Devanagari } from "next/font/google";

const demandNoticeNotoDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-devanagari",
  display: "swap",
});

const demandNoticeGeist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const demandNoticeJetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const demandNoticeFontClassName = `${demandNoticeNotoDevanagari.variable} ${demandNoticeGeist.variable} ${demandNoticeJetBrainsMono.variable}`;
