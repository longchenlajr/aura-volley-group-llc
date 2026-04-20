"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { products } from "@/content/products";
import { formatPriceUSD } from "@/lib/format";

export default function CartDrawer() {
  const { items, drawerOpen, closeDrawer, removeItem, updateQuantity, totalItems } = useCart();
  const router = useRouter();

  const lookup = (id: string) => products.find((p) => p.id === id);

  const subtotal = items.reduce((sum, item) => {
    const product = lookup(item.productId);
    return sum + (product?.price ?? 0) * item.quantity;
  }, 0);

  function handleCheckout() {
    closeDrawer();
    router.push("/checkout/");
  }

  const hasValidItems = items.some((i) => {
    const p = lookup(i.productId);
    return p && p.price != null;
  });

  return (
    <>
      {/* Backdrop */}
      <div
        className={`cart-backdrop ${drawerOpen ? "open" : ""}`}
        onClick={closeDrawer}
      />

      {/* Drawer */}
      <aside className={`cart-drawer ${drawerOpen ? "open" : ""}`}>
        <div className="cart-drawer-header">
          <span className="kicker kicker-bright">Your Cart</span>
          <button className="cart-close" onClick={closeDrawer} aria-label="Close cart">
            <span /><span />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="cart-empty">
            <p className="card-sub">Your cart is empty.</p>
            <Link href="/shop" className="btn" onClick={closeDrawer}>
              Browse shop &rarr;
            </Link>
          </div>
        ) : (
          <>
            <ul className="cart-items">
              {items.map((item) => {
                const product = lookup(item.productId);
                if (!product) return null;
                return (
                  <li key={`${item.productId}-${item.size}`} className="cart-item">
                    <div className="cart-item-image">
                      {product.images[0] && (
                        <Image
                          src={product.images[0]}
                          alt={product.name}
                          fill
                          sizes="64px"
                          style={{ objectFit: "cover" }}
                        />
                      )}
                    </div>
                    <div className="cart-item-details">
                      <div className="cart-item-name">{product.name}</div>
                      <div className="cart-item-meta">
                        <span className="kicker">{item.size}</span>
                        {product.price != null && (
                          <span className="price">{formatPriceUSD(product.price)}</span>
                        )}
                      </div>
                      <div className="cart-item-actions">
                        <div className="cart-qty">
                          <button
                            className="cart-qty-btn"
                            onClick={() => updateQuantity(item.productId, item.size, item.quantity - 1)}
                            aria-label="Decrease quantity"
                          >
                            &minus;
                          </button>
                          <span className="cart-qty-value">{item.quantity}</span>
                          <button
                            className="cart-qty-btn"
                            onClick={() => updateQuantity(item.productId, item.size, item.quantity + 1)}
                            aria-label="Increase quantity"
                          >
                            +
                          </button>
                        </div>
                        <button
                          className="cart-remove"
                          onClick={() => removeItem(item.productId, item.size)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="cart-footer">
              <div className="cart-summary">
                <span className="kicker">
                  Subtotal ({totalItems} item{totalItems !== 1 ? "s" : ""})
                </span>
                <span className="price">{formatPriceUSD(subtotal)}</span>
              </div>
              {hasValidItems ? (
                <button
                  className="btn btn-primary cart-checkout-btn"
                  onClick={handleCheckout}
                >
                  Checkout &rarr;
                </button>
              ) : (
                <div className="chip">
                  <span className="dot" />
                  Checkout opens when inventory drops
                </div>
              )}
            </div>
          </>
        )}
      </aside>
    </>
  );
}
