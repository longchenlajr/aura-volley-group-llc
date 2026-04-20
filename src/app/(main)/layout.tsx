import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import Providers from "@/components/Providers";

export default function MainLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <Providers>
      <Navbar />
      <CartDrawer />
      {children}
      <Footer />
    </Providers>
  );
}
