"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { inter, fraunces } from "@/lib/fonts";
import { DecorativeAsset } from "./DecorativeAsset";
import "./tournament.css";

const NAV_LINKS = [
  { href: "/longvolleyball", label: "Tournaments" },
  { href: "/longvolleyball/live", label: "Live" },
  { href: "/longvolleyball/rules", label: "Rules" },
  { href: "/longvolleyball/gallery", label: "Gallery" },
  { href: "/longvolleyball/records", label: "Records" },
];

export default function TournamentLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    document.documentElement.style.scrollBehavior = "smooth";

    // Hide scrollbar on html and body
    const style = document.createElement("style");
    style.textContent = "html,body{scrollbar-width:none;-ms-overflow-style:none}html::-webkit-scrollbar,body::-webkit-scrollbar{display:none}";
    document.head.appendChild(style);

    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    const prev = link?.href;
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = "/longvolleyball/vb.ico";

    return () => {
      document.documentElement.style.scrollBehavior = "auto";
      style.remove();
      if (link && prev) link.href = prev;
    };
  }, []);

  // Lightweight session check (no SessionProvider needed)
  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => setIsLoggedIn(!!data?.user))
      .catch(() => setIsLoggedIn(false));
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function isActive(href: string) {
    if (href === "/longvolleyball") {
      return pathname === "/longvolleyball" || pathname === "/longvolleyball/";
    }
    return pathname.startsWith(href);
  }

  return (
    <div className={`lv ${inter.variable} ${fraunces.variable}`}>
      {/* Header */}
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
                  aria-current={isActive(link.href) ? "page" : undefined}
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
              <Link href="/admin" className="lv-header-login">
                Admin
              </Link>
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

      {/* Mobile dropdown */}
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
            <Link href="/admin" className="lv-btn lv-btn-ghost" style={{ marginTop: "0.25rem" }}>
              Admin Dashboard
            </Link>
          ) : (
            <Link href="/admin/login" className="lv-btn lv-btn-ghost" style={{ marginTop: "0.25rem" }}>
              Log in
            </Link>
          )}
        </nav>
      </div>

      {/* Main content */}
      <main className="lv-animate" key={pathname}>
        {children}
      </main>

      {/* Footer */}
      <footer className="lv-footer">
        <div className="lv-container lv-footer-inner">
          <div className="lv-footer-left">
            <span className="lv-footer-left-text">Thank You <span style={{ color: "var(--lv-red)" }}>&hearts;</span> The Longs</span>
          </div>
          <div className="lv-footer-center">
            <DecorativeAsset src="blossom-single.png" className="lv-footer-blossom-img" width={32} height={32} />
          </div>
          <div className="lv-footer-right">
            Powered by Aura Volley Group LLC
          </div>
        </div>
      </footer>
    </div>
  );
}
