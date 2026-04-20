"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { inter, fraunces } from "@/lib/fonts";

const NAV_LINKS = [
  { href: "/longvolleyball", label: "Tournaments" },
  { href: "/longvolleyball/live", label: "Live" },
  { href: "/longvolleyball/gallery", label: "Gallery" },
  { href: "/longvolleyball/records", label: "Records" },
];

function AdminHeader() {
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => setIsLoggedIn(!!data?.user))
      .catch(() => setIsLoggedIn(false));
  }, []);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  function isActive(href: string) {
    if (href === "/longvolleyball") {
      return pathname === "/longvolleyball" || pathname === "/longvolleyball/";
    }
    return pathname.startsWith(href);
  }

  function handleLogout() {
    fetch("/api/auth/signout", { method: "POST" })
      .then(() => { window.location.href = "/admin/login"; })
      .catch(() => { window.location.href = "/admin/login"; });
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
            <Link href="/longvolleyball/register" className="lv-header-cta">
              Register
            </Link>
            {isLoggedIn ? (
              <button className="lv-header-login" onClick={handleLogout}>
                Log out
              </button>
            ) : (
              <Link href="/admin/login" className="lv-header-login">
                Log in
              </Link>
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
          <Link href="/longvolleyball/register" className="lv-btn lv-btn-primary" style={{ marginTop: "0.5rem" }}>
            Register
          </Link>
          {isLoggedIn ? (
            <button
              className="lv-btn lv-btn-ghost"
              style={{ marginTop: "0.25rem" }}
              onClick={handleLogout}
            >
              Log out
            </button>
          ) : (
            <Link href="/admin/login" className="lv-btn lv-btn-ghost" style={{ marginTop: "0.25rem" }}>
              Log in
            </Link>
          )}
        </nav>
      </div>
    </>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = "html,body{scrollbar-width:none;-ms-overflow-style:none}html::-webkit-scrollbar,body::-webkit-scrollbar{display:none}";
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);

  return (
    <div className={`lv ${inter.variable} ${fraunces.variable}`}>
      <AdminHeader />
      <main>{children}</main>
    </div>
  );
}
