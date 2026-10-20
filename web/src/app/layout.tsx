import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { AppProviders } from "@/components/providers/app-providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Draftly — Email, thoughtfully written",
  description: "Turn a few notes into a polished email draft. Review it before you use it.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body className={GeistSans.className}><AppProviders>{children}</AppProviders></body></html>;
}
