import type { Metadata } from "next";
import "./globals.css";
import {LanguageProvider} from "@/components/LanguageProvider";

export const metadata: Metadata = {
  title: "BAZARSPORT — Football Intelligence",
  description: "Футболни анализи, прогнози и проверени резултати с редакционен контрол.",
  icons: {
    icon: "/assets/mark.svg",
    shortcut: "/assets/mark.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bg">
      <body className="antialiased"><LanguageProvider>{children}</LanguageProvider></body>
    </html>
  );
}
