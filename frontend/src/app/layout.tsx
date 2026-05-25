import type { Metadata } from "next";
import Link from "next/link";
import { Manrope, Sora } from "next/font/google";
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

          <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur">
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
              <Link href="/" className="flex items-center gap-2 font-heading text-xl font-semibold tracking-tight text-ink">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-800 text-sm text-white">
                  N
                </span>
                <span>NetUp</span>
              </Link>
            </div>
          </header>

          <div className="relative mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8">{children}</div>
        </div>
      </body>
    </html>
  );
}
