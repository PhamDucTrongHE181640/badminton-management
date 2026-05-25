"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface RoleNavLink {
  href: string;
  label: string;
}

interface RoleNavProps {
  links: RoleNavLink[];
}

export function RoleNav({ links }: RoleNavProps) {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex gap-2 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
      {links.map((link) => {
        const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`shrink-0 rounded-md px-3 py-2 text-sm font-semibold transition ${
              isActive ? "bg-red-800 text-white shadow-sm hover:bg-red-900" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
