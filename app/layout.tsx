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
  title: `${BRAND.name} | What would an ADU return on your property?`,
  description:
    "Enter your address for a free ADU ROI report: build cost, long-term and short-term rent, cash flow, payback, and added home value for a Los Angeles ADU or garage conversion.",
  applicationName: BRAND.name,
  openGraph: {
    title: `${BRAND.name} | Free ADU ROI report`,
    description: "Build cost, rent, payback, and added value for an ADU on your lot, in about two minutes.",
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
