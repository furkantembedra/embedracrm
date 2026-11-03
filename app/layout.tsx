import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Sidebar from "@/components/layout/sidebar";
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
      <body>
        <div className="flex min-h-screen flex-col bg-bg lg:flex-row">
          <Sidebar />
          <main className="flex min-w-0 flex-1 flex-col gap-5 px-4 pb-10 pt-6 sm:px-7">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
