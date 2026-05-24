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
    <nav className="mb-6 flex flex-wrap gap-2">
      {links.map((link) => {
        const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              isActive ? "bg-ink text-white" : "bg-white text-slate-600 hover:bg-slate-100"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
