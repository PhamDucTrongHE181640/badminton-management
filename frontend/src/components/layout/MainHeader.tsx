"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { HeaderUserAuth, UserProfile } from "./HeaderUserAuth";
import { apiFetch } from "@/lib/http";

const baseNavLinks = [
  { href: "/", label: "Trang Chủ" },
  { href: "/player/discovery?mode=booking", label: "Đặt sân riêng" },
  { href: "/player/discovery?mode=matchmaking", label: "Xếp đối vãng lai" },
  { href: "/player/tournaments", label: "Giải đấu" },
  { href: "/owner/courts", label: "Quản lý sân", requireRole: "owner" },
  { href: "/contact", label: "Liên hệ", requireRole: "player" },
];

const expenseNavLinks = [
  {
    href: "/player/expenses/new",
    label: "Tính chia tiền nhanh",
    desc: "Tạo hoá đơn và chia tiền ngay lập tức",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0 text-red-700">
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M9 21V9h12" /><path d="M14 14h2" /><path d="M14 16h2" /><path d="M10 14h2" /><path d="M10 16h2" />
      </svg>
    ),
  },
  {
    href: "/player/expenses",
    label: "Chia sẻ chi phí",
    desc: "Lịch sử chia tiền theo từng buổi chơi",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0 text-red-700">
        <line x1="12" x2="12" y1="1" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    href: "/player/debts",
    label: "Công nợ tích lũy",
    desc: "Cấn trừ chéo và thanh toán qua QR",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0 text-red-700">
        <path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18 14h-8" /><path d="M15 11h-5" /><path d="M12 8H8" /><circle cx="18" cy="5" r="3" />
      </svg>
    ),
  },
];

function splitHref(href: string) {
  const [path, query = ""] = href.split("?");
  return { path, query };
}

export function MainHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [location, setLocation] = useState("Hòa Lạc, Hà Nội");
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
  const [isExpenseMenuOpen, setIsExpenseMenuOpen] = useState(false);
  const [currentSearch, setCurrentSearch] = useState("");
  const expenseMenuRef = useRef<HTMLDivElement>(null);

  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const loadProfile = async () => {
    try {
      const profile = await apiFetch<UserProfile>("/api/v1/auth/me", {
        credentials: "include",
      });
      setUser(profile);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    void loadProfile();
  }, []);

  // Close expense menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (expenseMenuRef.current && !expenseMenuRef.current.contains(event.target as Node)) {
        setIsExpenseMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function logout() {
    setIsLoggingOut(true);
    try {
      await apiFetch("/api/v1/auth/logout", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({}),
      });
      setUser(null);
      router.push("/");
    } finally {
      setIsLoggingOut(false);
    }
  }

  const isOwner = user?.roles.includes("owner") ?? false;

  useEffect(() => {
    const syncSearch = () => setCurrentSearch(window.location.search);
    syncSearch();
    window.addEventListener("popstate", syncSearch);
    return () => window.removeEventListener("popstate", syncSearch);
  }, [pathname]);

  const locations = [
    "Hòa Lạc, Hà Nội",
    "Cầu Giấy, Hà Nội",
    "Mỹ Đình, Hà Nội",
    "Thanh Xuân, Hà Nội",
  ];

  function isActive(href: string) {
    const { path, query } = splitHref(href);
    if (path === "/") return pathname === "/";
    if (query) return pathname === path && currentSearch.includes(query);
    return pathname === path || pathname.startsWith(`${path}/`);
  }

  function isExpenseActive() {
    return ["/player/expenses", "/player/debts"].some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    );
  }

  function handleNavClick(href: string) {
    const { query } = splitHref(href);
    setCurrentSearch(query ? `?${query}` : "");
    setIsMobileMenuOpen(false);
    setIsExpenseMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-50 h-[72px] border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-full w-full max-w-[1500px] items-center justify-between px-5 sm:px-8">
        <div className="flex h-full min-w-0 items-center gap-6 lg:gap-8">
          <Link href="/" className="flex shrink-0 items-center" onClick={() => handleNavClick("/")}>
            <img src="/courts/logo.png" alt="NetUp Logo" className="h-10 w-auto object-contain sm:h-11" />
          </Link>

          <nav className="hidden h-full items-center gap-5 text-sm font-semibold xl:flex 2xl:gap-6">
            {baseNavLinks
              .filter((item) => {
                if (item.requireRole === "owner" && !isOwner) return false;
                if (item.requireRole === "player" && isOwner) return false;
                return true;
              })
              .map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => handleNavClick(item.href)}
                    className={`relative flex h-full items-center whitespace-nowrap transition duration-150 ${
                      active ? "text-red-800" : "text-slate-700 hover:text-red-800"
                    }`}
                  >
                    {item.label}
                    {active ? <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-red-800" /> : null}
                  </Link>
                );
              })}

            {/* Chi phí Dropdown Navbar Item (chỉ hiện khi đã đăng nhập) */}
            {user && (
              <div className="relative flex h-full items-center" ref={expenseMenuRef}>
                <button
                  onClick={() => setIsExpenseMenuOpen((prev) => !prev)}
                  className={`relative flex h-full items-center gap-1 whitespace-nowrap transition duration-150 cursor-pointer ${
                    isExpenseActive() ? "text-red-800" : "text-slate-700 hover:text-red-800"
                  }`}
                >
                  Chi phí
                  <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpenseMenuOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {isExpenseActive() && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-red-800" />}
                </button>

                {isExpenseMenuOpen && (
                  <div className="absolute left-1/2 top-[72px] z-50 w-[280px] -translate-x-1/2 rounded-2xl border border-slate-100/90 bg-white p-2.5 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.12)] animate-in fade-in slide-in-from-top-2 duration-150">
                    {/* Mũi tên nhỏ chỉ lên navbar */}
                    <div className="absolute -top-[6px] left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-white border-t border-l border-slate-100/90" />
                    {expenseNavLinks.map((link) => {
                      const active = isActive(link.href);
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => handleNavClick(link.href)}
                          className={`flex items-start gap-3 rounded-xl p-3 transition duration-150 group ${
                            active ? "bg-red-50" : "hover:bg-slate-50"
                          }`}
                        >
                          <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${active ? "bg-red-100 border-red-200" : "bg-slate-100 border-slate-200 group-hover:bg-red-50 group-hover:border-red-100"} transition`}>
                            {link.icon}
                          </div>
                          <div>
                            <p className={`text-[13px] font-bold ${active ? "text-red-800" : "text-slate-800"}`}>{link.label}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{link.desc}</p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-3 lg:gap-4">
          <div className="relative hidden md:block">
            <button
              onClick={() => setIsLocationDropdownOpen((value) => !value)}
              className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-xs transition duration-150 hover:bg-slate-50"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-red-600" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2a8 8 0 00-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 00-8-8z" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="10" r="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="max-w-[132px] truncate">{location}</span>
              <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-150 ${isLocationDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {isLocationDropdownOpen ? (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsLocationDropdownOpen(false)} />
                <div className="absolute right-0 z-50 mt-2 w-[180px] rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                  {locations.map((loc) => (
                    <button
                      key={loc}
                      onClick={() => {
                        setLocation(loc);
                        setIsLocationDropdownOpen(false);
                      }}
                      className={`block w-full rounded-lg px-3 py-1.5 text-left text-xs transition ${
                        location === loc ? "bg-red-50 font-semibold text-red-800" : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>

          {/* Cart Icon with red badge */}
          {user && (
            <Link
              href="/player/bookings"
              onClick={() => handleNavClick("/player/bookings")}
              aria-label="Giỏ hàng và đơn đặt sân"
              title="Giỏ hàng / đơn đã đặt"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition duration-150 hover:border-red-300 hover:bg-red-50 hover:text-red-700 relative shrink-0"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M6.5 7.5h11l-1 8h-8.5l-1.5-11h-2.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9 19.5h.01M16 19.5h.01" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          )}

          {/* Notification Bell */}
          {user && (
            <button
              aria-label="Thông báo"
              title="Thông báo của bạn"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition duration-150 hover:border-red-300 hover:bg-red-50 hover:text-red-700 relative shrink-0 cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}

          {/* Authentication State button */}
          <HeaderUserAuth user={user} logout={logout} isLoggingOut={isLoggingOut} onProfileUpdated={loadProfile} />

          <button
            onClick={() => setIsMobileMenuOpen((value) => !value)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition duration-150 hover:border-red-300 hover:bg-red-50 xl:hidden"
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

      {isMobileMenuOpen ? (
        <>
          <div className="fixed inset-0 top-[72px] z-30 bg-slate-900/20 backdrop-blur-xs xl:hidden" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="absolute left-0 right-0 top-[72px] z-40 flex max-h-[calc(100vh-72px)] flex-col gap-2 overflow-y-auto border-b border-slate-200 bg-white p-4 shadow-xl xl:hidden">
            {baseNavLinks
              .filter((item) => {
                if (item.requireRole === "owner" && !isOwner) return false;
                if (item.requireRole === "player" && isOwner) return false;
                return true;
              })
              .map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => handleNavClick(item.href)}
                    className={`block rounded-lg px-4 py-2.5 text-sm font-semibold transition duration-150 ${
                      active ? "bg-red-50 text-red-800" : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}

            {/* Chi phí section trên Mobile Menu */}
            {user && (
              <>
                <div className="border-t border-slate-100 pt-2">
                  <p className="px-4 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Chi phí</p>
                </div>
                {expenseNavLinks.map((link) => {
                  const active = isActive(link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => handleNavClick(link.href)}
                      className={`flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-semibold transition duration-150 ${
                        active ? "bg-red-50 text-red-800" : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {link.icon}
                      {link.label}
                    </Link>
                  );
                })}
              </>
            )}
          </div>
        </>
      ) : null}
    </header>
  );
}
