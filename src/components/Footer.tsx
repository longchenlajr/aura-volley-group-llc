import Link from "next/link";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        {/* <nav className="footer-links">
          <Link href="/atownaura" className="footer-link">A-Town Aura</Link>
          <Link href="/shop" className="footer-link">Shop</Link>
          <Link href="/drops" className="footer-link">Drops</Link>
          <Link href="/schedule" className="footer-link">Schedule</Link>
          <Link href="/about" className="footer-link">About</Link>
        </nav> */}
        <div className="footer-copy">
          &copy; {new Date().getFullYear()} Aura Volley Group LLC
        </div>
      </div>
    </footer>
  );
}
