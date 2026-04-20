"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { SessionProvider, signOut, useSession } from "next-auth/react";
import type { ReactNode } from "react";
import { inter, fraunces } from "@/lib/fonts";

const NAV_LINKS = [
  { href: "/longvolleyball", label: "Tournaments" },
  { href: "/longvolleyball/gallery", label: "Gallery" },
  { href: "/longvolleyball/records", label: "Records" },
];

function AdminHeader() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  function isActive(href: string) {
    if (href === "/longvolleyball") {
      return pathname === "/longvolleyball" || pathname === "/longvolleyball/";
    }
    return pathname.startsWith(href);
  }

  return (
    <>
      <header className="lv-header">
        <div className="lv-container lv-header-inner">
          <Link href="/longvolleyball" className="lv-header-wordmark">
            Long Volleyball
          </Link>

          <nav className="lv-header-nav" aria-label="Tournament navigation">
            {NAV_LINKS.map((link, i) => (
              <span key={link.href} className="lv-header-nav-item">
                {i > 0 && <span className="lv-header-nav-diamond" aria-hidden="true" />}
                <Link
                  href={link.href}
                  className={`lv-header-nav-link ${isActive(link.href) ? "active" : ""}`}
                >
                  {link.label}
                </Link>
              </span>
            ))}
          </nav>

          <div className="lv-header-right">
            {session && (
              <button
                className="lv-header-cta"
                onClick={() => signOut({ callbackUrl: "/admin/login" })}
              >
                Log out
              </button>
            )}
            <button
              className={`lv-header-burger ${mobileOpen ? "open" : ""}`}
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>

      <div className={`lv-mobile-menu ${mobileOpen ? "open" : ""}`}>
        <nav className="lv-mobile-menu-inner">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`lv-mobile-menu-link ${isActive(link.href) ? "active" : ""}`}
            >
              {link.label}
            </Link>
          ))}
          {session && (
            <button
              className="lv-btn lv-btn-secondary"
              style={{ marginTop: "0.5rem" }}
              onClick={() => signOut({ callbackUrl: "/admin/login" })}
            >
              Log out
            </button>
          )}
        </nav>
      </div>
    </>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <div className={`lv ${inter.variable} ${fraunces.variable}`}>
        <AdminHeader />
        <main>{children}</main>
      </div>
    </SessionProvider>
  );
}
