import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "lenis/dist/lenis.css";
import "./globals.css";
import { ChatWidget } from "@/components/ui/ChatWidget";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  variable: "--font-editorial",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "WebNexus | Order from Complexity",
  description:
    "A cinematic portfolio journey through WebNexus: precision web apps, business systems, AI integrations, and rescue engineering.",
  openGraph: {
    title: "WebNexus | Precision Digital Systems",
    description:
      "We turn operational complexity into precise, dependable digital systems.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${cormorant.variable}`}
    >
      <body>
        {children}
        <ChatWidget />
      </body>
    </html>
  );
}
