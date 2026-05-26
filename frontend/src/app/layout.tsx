import type { Metadata } from "next";
import { Manrope, Sora } from "next/font/google";
import { MainHeader } from "@/components/layout";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "vietnamese"],
  display: "swap",
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
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
      <body className={`${manrope.variable} ${sora.variable} antialiased`}>
        <div className="relative min-h-screen bg-[#f5f6f8] text-ink">
          <div className="pointer-events-none absolute inset-0 bg-noise-grid bg-[size:32px_32px] opacity-70" />

          <MainHeader />

          <main className="relative mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
