"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { drops } from "@/content/drops";

const links = [
  { label: "Team", href: "/team" },
  { label: "Schedule", href: "/schedule" },
  { label: "About", href: "/about" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [shopOpen, setShopOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const shopActive =
    pathname === "/shop" ||
    pathname.startsWith("/shop/") ||
    pathname.startsWith("/drops/");

  function enter() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setShopOpen(true);
  }

  function leave() {
    timeoutRef.current = setTimeout(() => setShopOpen(false), 250);
  }

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  return (
    <header className="nav-shell">
      <div className="nav-inner">
        <Link href="/" className="nav-logo">
          <Image
            src="/img/logo1.png"
            alt="Aura Volley Group"
            width={30}
            height={30}
            style={{ borderRadius: 6, objectFit: "contain" }}
          />
          Aura Volley
        </Link>

        <nav className="nav-links" aria-label="Primary">
          {/* Shop with inline sub-links */}
          <div
            className="nav-shop-group"
            onMouseEnter={enter}
            onMouseLeave={leave}
          >
            <Link
              href="/shop"
              className={`nav-link ${shopActive ? "active" : ""}`}
              aria-current={shopActive ? "page" : undefined}
            >
              Shop
            </Link>

            <div className={`nav-sub ${shopOpen ? "open" : ""}`}>
              <span className="nav-sub-divider" />
              {/* <Link href="/shop" className="nav-sub-link">
                All
              </Link> */}
              {drops.map((d) => (
                <Link
                  key={d.slug}
                  href={`/drops/${d.slug}`}
                  className="nav-sub-link"
                >
                  {d.name}
                </Link>
              ))}
            </div>
          </div>

          {links.map((l) => {
            const active =
              pathname === l.href || pathname.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`nav-link ${active ? "active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
