"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { HeaderUserAuth } from "./HeaderUserAuth";

const bookingLinks = [
  {
    href: "/player/discovery?mode=booking",
    label: "Đặt lịch trực quan",
    description: "Tìm sân và xem khung giờ còn trống",
  },
  {
    href: "/player/discovery?mode=matchmaking",
    label: "Xếp đối (Matchmaking)",
    description: "Ghép kèo theo Elo đã lưu",
  },
];

function isActive(pathname: string, href: string) {
  const cleanHref = href.split("?")[0];
  return pathname === cleanHref || pathname.startsWith(`${cleanHref}/`);
}

export function MainHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-heading text-xl font-semibold tracking-tight text-ink">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-800 text-sm text-white shadow-sm">
            N
          </span>
          <span>netUP</span>
        </Link>

        <nav className="order-3 flex w-full items-center gap-1 overflow-x-auto text-sm font-semibold lg:order-none lg:w-auto lg:overflow-visible">
          <Link
            href="/"
            className={`shrink-0 rounded-full px-3 py-2 transition ${
              pathname === "/" ? "bg-red-800 text-white shadow-sm" : "text-slate-700 hover:bg-red-50 hover:text-red-800"
            }`}
          >
            Trang chủ
          </Link>

          <div className="group relative shrink-0">
            <Link
              href="/player/discovery?mode=booking"
              className={`inline-flex items-center gap-1 rounded-full px-3 py-2 transition ${
                isActive(pathname, "/player/discovery")
                  ? "bg-red-800 text-white shadow-sm"
                  : "text-slate-700 hover:bg-red-50 hover:text-red-800"
              }`}
            >
              Đặt sân
              <span aria-hidden="true" className="text-xs">
                v
              </span>
            </Link>
            <div className="invisible absolute left-0 top-full z-50 w-[280px] translate-y-1 pt-2 opacity-0 transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
              <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
                {bookingLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block rounded-md px-3 py-2 text-left transition hover:bg-emerald-50"
                  >
                    <span className="block text-sm font-semibold text-slate-950">{item.label}</span>
                    <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">{item.description}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <Link
            href="/contact"
            className={`shrink-0 rounded-full px-3 py-2 transition ${
              pathname === "/contact" ? "bg-red-800 text-white shadow-sm" : "text-slate-700 hover:bg-red-50 hover:text-red-800"
            }`}
          >
            Liên hệ với chúng tôi
          </Link>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/player/bookings"
            aria-label="Giỏ hàng và đơn đặt sân"
            title="Giỏ hàng / đơn đã đặt"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6.5 7.5h11l-1 8h-8.5l-1.5-11h-2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9 19.5h.01M16 19.5h.01" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <label className="sr-only" htmlFor="language-select">
            Ngôn ngữ
          </label>
          <select
            id="language-select"
            className="h-10 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none transition hover:border-emerald-300 focus:border-emerald-500"
            defaultValue="vi"
          >
            <option value="vi">VI</option>
            <option value="en">EN</option>
          </select>
          <HeaderUserAuth />
        </div>
      </div>
    </header>
  );
}
