import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "İSG Vardiya Planlayıcı | Otomatik ve Yasal Uyumlu Çizelgeleme",
  description: "Vardiyalı çalışan işletmeler için İş Sağlığı ve Güvenliği (İSG) kurallarına ve İş Kanunu limitlerine uygun, otomatik vardiya çizelgesi oluşturan modern ve profesyonel web uygulaması.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
