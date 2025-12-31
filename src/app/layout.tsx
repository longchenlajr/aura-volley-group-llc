import type { Metadata } from "next";
import "./globals.css";
// import Nav from "@/components/Nav";
// import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Aura Volley Group",
  description: "Aura Volley Group LLC — Spring26 drop.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {/* <Nav /> */}
        {children}
        {/* <Footer /> */}
      </body>
    </html>
  );
}
