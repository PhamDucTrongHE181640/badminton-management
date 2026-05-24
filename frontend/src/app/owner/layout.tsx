import { RoleNav } from "@/components/layout";

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <section className="fade-up">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Chủ sân</p>
      <RoleNav
        links={[
          { href: "/owner/dashboard", label: "Tổng quan" },
          { href: "/owner/courts", label: "Quản lý sân" },
          { href: "/owner/check-in", label: "Check-in" },
        ]}
      />
      {children}
    </section>
  );
}
