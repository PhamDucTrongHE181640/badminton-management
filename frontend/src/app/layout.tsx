import type { Metadata } from "next";
import { Montserrat, Inter } from "next/font/google";
import { MainHeader } from "@/components/layout";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "600", "700", "900"],
  style: ["normal", "italic"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "vietnamese"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "NetUp",
  description: "Nền tảng đặt sân thể thao và vận hành chủ sân NetUp",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className={`${montserrat.variable} ${inter.variable} font-sans antialiased`}>
        <div className="relative min-h-screen bg-[#F3F4F6] text-[#111111]">
          <div className="pointer-events-none absolute inset-0 bg-noise-grid bg-[size:32px_32px] opacity-70" />
          <MainHeader />
          <main className="relative w-full">{children}</main>
        </div>
      </body>
    </html>
  );
}