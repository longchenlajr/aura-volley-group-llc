"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect, useCallback } from "react";
import { drops } from "@/content/drops";

function useHoverGroup() {
  const [open, setOpen] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const enter = useCallback(() => {
    if (timeout.current) clearTimeout(timeout.current);
    setOpen(true);
  }, []);

  const leave = useCallback(() => {
    timeout.current = setTimeout(() => setOpen(false), 250);
  }, []);

  useEffect(
    () => () => {
      if (timeout.current) clearTimeout(timeout.current);
    },
    [],
  );

  return { open, enter, leave };
}

export default function Navbar() {
  const pathname = usePathname();
  const shop = useHoverGroup();
  const team = useHoverGroup();

  const shopActive =
    pathname === "/shop" ||
    pathname.startsWith("/shop/") ||
    pathname.startsWith("/drops/");

  const teamActive =
    pathname === "/atownaura" ||
    pathname.startsWith("/atownaura/") ||
    pathname === "/schedule" ||
    pathname.startsWith("/schedule/");

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
          {/* A-Town Aura with inline sub-links */}
          <div
            className="nav-shop-group"
            onMouseEnter={team.enter}
            onMouseLeave={team.leave}
          >
            <Link
              href="/atownaura"
              className={`nav-link ${teamActive ? "active" : ""}`}
              aria-current={teamActive ? "page" : undefined}
            >
              A-Town Aura
            </Link>

            <div className={`nav-sub ${team.open ? "open" : ""}`}>
              <span className="nav-sub-divider" />
              <Link href="/atownaura" className="nav-sub-link">
                Roster
              </Link>
              <Link href="/schedule" className="nav-sub-link">
                Schedule
              </Link>
            </div>
          </div>

          {/* Shop with inline sub-links */}
          <div
            className="nav-shop-group"
            onMouseEnter={shop.enter}
            onMouseLeave={shop.leave}
          >
            <Link
              href="/shop"
              className={`nav-link ${shopActive ? "active" : ""}`}
              aria-current={shopActive ? "page" : undefined}
            >
              Shop
            </Link>

            <div className={`nav-sub ${shop.open ? "open" : ""}`}>
              <span className="nav-sub-divider" />
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

          <Link
            href="/about"
            className={`nav-link ${pathname === "/about" ? "active" : ""}`}
            aria-current={pathname === "/about" ? "page" : undefined}
          >
            About
          </Link>
        </nav>
      </div>
    </header>
  );
}
