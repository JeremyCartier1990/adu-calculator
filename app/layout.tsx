import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { BRAND } from "@/lib/brand";
import { REDTRACK_SCRIPT } from "@/lib/redtrack";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(BRAND.url),
  title: `${BRAND.name} | What would an ADU add to your home?`,
  description:
    "Get your own ADU estimate online, with no sales call: what an ADU or garage conversion costs, how much value it adds, and what it rents for after the loan payments.",
  applicationName: BRAND.name,
  openGraph: {
    title: `${BRAND.name} | Free ADU ROI report`,
    description: "Your own ADU estimate in about a minute, online, with no sales call: cost, value added, and rent after the loan.",
    url: BRAND.url,
    siteName: BRAND.name,
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-paper font-sans text-ink">
        {children}
        <Script src={REDTRACK_SCRIPT} strategy="afterInteractive" />
      </body>
    </html>
  );
}
