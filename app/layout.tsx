import { ListingDefaultsInitScript } from "@/components/ops/listing-defaults-init-script";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PreferencesInitScript } from "@/components/preferences/preferences-init-script";
import { UiPreferencesProvider } from "@/components/preferences/ui-preferences-provider";
import { AuthProvider } from "@/components/auth/auth-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OPS | Operational Excellence Platform",
  description:
    "Operational audits, action tracking, analytics, and workplace improvement management.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ListingDefaultsInitScript />
        <PreferencesInitScript />
        <UiPreferencesProvider><AuthProvider>{children}</AuthProvider></UiPreferencesProvider>
      </body>
    </html>
  );
}
