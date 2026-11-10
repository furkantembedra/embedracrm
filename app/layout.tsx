import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Embedra CRM",
  description: "EmbedraONE satış, lisans, destek ve bayi yönetimi",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className={`${jakarta.variable} antialiased`}>
      <body className="bg-bg">{children}</body>
    </html>
  );
}
