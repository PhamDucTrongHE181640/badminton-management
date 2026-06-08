"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { RoleNav } from "@/components/layout";

function PlayerNavigation() {
  const searchParams = useSearchParams();
  const isMatchmaking = searchParams.get("mode") === "matchmaking";

  if (isMatchmaking) {
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
        ]}
      />
    </>
  );
}

export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  return (
    <section className="fade-up mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
      <Suspense fallback={null}>
        <PlayerNavigation />
      </Suspense>
      {children}
    </section>
  );
}
