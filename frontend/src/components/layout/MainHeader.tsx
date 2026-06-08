"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [location, setLocation] = useState("Hòa Lạc, Hà Nội");
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);

  const locations = [
    "Hòa Lạc, Hà Nội",
    "Cầu Giấy, Hà Nội",
    "Mỹ Đình, Hà Nội",
    "Thanh Xuân, Hà Nội",
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur h-[72px]">
      <div className="mx-auto flex h-full w-full max-w-7xl items-center justify-between px-4 sm:px-6">
        
        {/* Left Section: Logo and Navigation Menu */}
        <div className="flex h-full items-center gap-6 lg:gap-8">
          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center">
            <img src="/courts/logo.png" alt="NetUp Logo" className="h-10 w-auto object-contain sm:h-11" />
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden h-full lg:flex items-center gap-6 text-[15px] font-semibold">
            <Link
              href="/"
              className={`relative h-full flex items-center transition duration-150 ${
                pathname === "/" ? "text-red-800" : "text-slate-700 hover:text-red-800"
              }`}
            >
              Trang chủ
              {pathname === "/" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-800 rounded-full" />
              )}
            </Link>

            {/* Đặt sân Dropdown */}
            <div className="group relative h-full flex items-center shrink-0">
              <button
                className={`inline-flex items-center gap-1 h-full transition duration-150 cursor-pointer ${
                  isActive(pathname, "/player/discovery")
                    ? "text-red-800"
                    : "text-slate-700 hover:text-red-800"
                }`}
              >
                Đặt sân
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-current transition-transform duration-200 group-hover:rotate-180" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <div className="invisible absolute left-0 top-[72px] z-50 w-[260px] translate-y-1 opacity-0 transition duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                <div className="rounded-xl border border-slate-200/80 bg-white p-2 shadow-lg mt-1">
                  {bookingLinks.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="block rounded-lg px-3 py-2 text-left transition duration-150 hover:bg-red-50"
                    >
                      <span className="block text-sm font-semibold text-slate-950">{item.label}</span>
                      <span className="mt-0.5 block text-xs font-normal leading-relaxed text-slate-500">{item.description}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* Separator • */}
            <span className="text-slate-300 pointer-events-none select-none">•</span>

            {/* Ghép đối thủ */}
            <Link
              href="/player/matches"
              className={`relative h-full flex items-center transition duration-150 ${
                pathname.startsWith("/player/matches") ? "text-red-800" : "text-slate-700 hover:text-red-800"
              }`}
            >
              Ghép đối thủ
              {pathname.startsWith("/player/matches") && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-800 rounded-full" />
              )}
            </Link>

            {/* Giải đấu */}
            <Link
              href="/player/tournaments"
              className={`relative h-full flex items-center transition duration-150 ${
                pathname.startsWith("/player/tournaments") ? "text-red-800" : "text-slate-700 hover:text-red-800"
              }`}
            >
              Giải đấu
              {pathname.startsWith("/player/tournaments") && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-800 rounded-full" />
              )}
            </Link>

            {/* Liên hệ */}
            <Link
              href="/contact"
              className={`relative h-full flex items-center transition duration-150 ${
                pathname === "/contact" ? "text-red-800" : "text-slate-700 hover:text-red-800"
              }`}
            >
              Liên hệ
              {pathname === "/contact" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-800 rounded-full" />
              )}
            </Link>
          </nav>
        </div>

        {/* Right Section: Utility Tools & Auth */}
        <div className="flex items-center gap-2 sm:gap-3.5">
          {/* Location Selector */}
          <div className="relative">
            <button
              onClick={() => setIsLocationDropdownOpen(!isLocationDropdownOpen)}
              className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-xs cursor-pointer hover:bg-slate-50 transition duration-150 sm:px-3.5"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-red-600 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2a8 8 0 00-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 00-8-8z" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="10" r="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="max-w-[80px] truncate sm:max-w-none">{location}</span>
              <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 text-slate-400 shrink-0 transition-transform duration-150 ${isLocationDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            
            {isLocationDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsLocationDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-2 z-50 w-[180px] rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                  {locations.map((loc) => (
                    <button
                      key={loc}
                      onClick={() => {
                        setLocation(loc);
                        setIsLocationDropdownOpen(false);
                      }}
                      className={`w-full block rounded-lg px-3 py-1.5 text-left text-xs transition cursor-pointer ${
                        location === loc
                          ? "bg-red-50 text-red-800 font-semibold"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Cart Icon with red badge */}
          <Link
            href="/player/bookings"
            aria-label="Giỏ hàng và đơn đặt sân"
            title="Giỏ hàng / đơn đã đặt"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition duration-150 hover:border-red-300 hover:bg-red-50 hover:text-red-700 relative shrink-0"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6.5 7.5h11l-1 8h-8.5l-1.5-11h-2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9 19.5h.01M16 19.5h.01" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-white" />
          </Link>

          {/* Notification Bell with circle badge showing '2' */}
          <button
            aria-label="Thông báo"
            title="Thông báo của bạn"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition duration-150 hover:border-red-300 hover:bg-red-50 hover:text-red-700 relative shrink-0 cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="absolute -top-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white ring-2 ring-white">
              2
            </span>
          </button>

          {/* Authentication State button */}
          <HeaderUserAuth />

          {/* Mobile Menu Toggle button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="inline-flex lg:hidden h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition duration-150 hover:border-red-300 hover:bg-red-50 cursor-pointer"
            aria-label={isMobileMenuOpen ? "Đóng menu" : "Mở menu"}
          >
            {isMobileMenuOpen ? (
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>

      </div>

      {/* Mobile Menu Overlay/Drawer */}
      {isMobileMenuOpen && (
        <>
          <div className="fixed inset-0 top-[72px] z-30 bg-slate-900/20 backdrop-blur-xs lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="lg:hidden absolute top-[72px] left-0 right-0 z-40 border-b border-slate-200 bg-white p-4 shadow-xl flex flex-col gap-2 animate-fade-in max-h-[calc(100vh-72px)] overflow-y-auto">
            <Link
              href="/"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`block rounded-lg px-4 py-2.5 text-sm font-semibold transition duration-150 ${
                pathname === "/" ? "bg-red-50 text-red-800" : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              Trang chủ
            </Link>
            
            <div className="border-t border-slate-100 my-1" />
            
            <div className="px-4 py-1 text-xs font-bold uppercase tracking-wider text-slate-400">
              Đặt sân
            </div>
            
            {bookingLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="block rounded-lg pl-8 pr-4 py-2 text-sm transition duration-150 hover:bg-slate-50 text-slate-700"
              >
                <span className="block font-semibold text-slate-900">{item.label}</span>
                <span className="block text-xs text-slate-500 mt-0.5">{item.description}</span>
              </Link>
            ))}

            <div className="border-t border-slate-100 my-1" />
            
            <Link
              href="/player/matches"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`block rounded-lg px-4 py-2.5 text-sm font-semibold transition duration-150 ${
                pathname.startsWith("/player/matches") ? "bg-red-50 text-red-800" : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              Ghép đối thủ
            </Link>

            <Link
              href="/player/tournaments"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`block rounded-lg px-4 py-2.5 text-sm font-semibold transition duration-150 ${
                pathname.startsWith("/player/tournaments") ? "bg-red-50 text-red-800" : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              Giải đấu
            </Link>

            <Link
              href="/contact"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`block rounded-lg px-4 py-2.5 text-sm font-semibold transition duration-150 ${
                pathname === "/contact" ? "bg-red-50 text-red-800" : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              Liên hệ
            </Link>
          </div>
        </>
      )}
    </header>
  );
}