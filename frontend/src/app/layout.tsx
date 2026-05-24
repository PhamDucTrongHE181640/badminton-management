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

const entryLinks = [
  { href: "/player/discovery", label: "Người chơi" },
  { href: "/owner/dashboard", label: "Chủ sân" },
  { href: "/_internal/netup-admin/dashboard", label: "Quản trị" },
];

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
        <div className="relative min-h-screen bg-[#f3f4f6] text-ink">
          <div className="pointer-events-none absolute inset-0 bg-noise-grid bg-[size:24px_24px] opacity-40" />
          <div className="pointer-events-none absolute -top-28 right-0 h-[300px] w-[300px] rounded-full bg-red-300/30 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-[280px] w-[280px] rounded-full bg-slate-300/35 blur-3xl" />

          <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur">
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
              <Link href="/" className="font-heading text-xl font-semibold tracking-tight text-ink">
                NetUp
              </Link>
              <nav className="hidden items-center gap-2 sm:flex">
                {entryLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-full px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>

          <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">{children}</div>
        </div>
      </body>
    </html>
  );
}
