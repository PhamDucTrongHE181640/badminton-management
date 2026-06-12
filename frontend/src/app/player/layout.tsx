"use client";

import { useSearchParams, usePathname } from "next/navigation";
import { Suspense } from "react";
import { RoleNav } from "@/components/layout";

function PlayerNavigation() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const isMatchmaking = searchParams.get("mode") === "matchmaking";
  const isTournaments = pathname.startsWith("/player/tournaments");

  if (isMatchmaking || isTournaments) {
    return null;
  }

  return (
    <>
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        Người chơi
      </p>
      <RoleNav
        links={[
          { href: "/player/discovery", label: "Đặt sân" },
          { href: "/player/assessment", label: "Level" },
          { href: "/player/bookings", label: "Booking của tôi" },
          { href: "/player/matches", label: "Lịch đấu" },
          { href: "/player/profile", label: "Hồ sơ" },
        ]}
      />
    </>
  );
}

export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  return (
    <section className="fade-up mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:py-8">
      <Suspense fallback={null}>
        <PlayerNavigation />
      </Suspense>
      {children}
    </section>
  );
}
