import { RoleNav } from "@/components/layout";

export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  return (
    <section className="fade-up">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        Người chơi
      </p>
      <RoleNav
        links={[
          { href: "/player/discovery", label: "Discovery" },
          { href: "/player/bookings", label: "Booking của tôi" },
          { href: "/player/assessment", label: "Assessment" },
          { href: "/player/matches", label: "Match history" },
        ]}
      />
      {children}
    </section>
  );
}
