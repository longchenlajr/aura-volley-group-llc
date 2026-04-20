"use client";

import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  AddressElement,
  LinkAuthenticationElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import type { StripeElementsOptions } from "@stripe/stripe-js";
import Image from "next/image";
import Container from "@/components/Container";
import { useCart } from "@/context/CartContext";
import { products } from "@/content/products";
import { formatPriceUSD } from "@/lib/format";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
);

const appearance: StripeElementsOptions["appearance"] = {
  theme: "night",
  variables: {
    colorPrimary: "#a078ff",
    colorBackground: "#18181c",
    colorText: "rgba(255, 255, 255, 0.93)",
    colorTextSecondary: "rgba(255, 255, 255, 0.72)",
    colorDanger: "#ff4d4d",
    fontFamily: "EastmanGrotesque, system-ui, sans-serif",
    borderRadius: "8px",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": {
      border: "1px solid rgba(255, 255, 255, 0.08)",
      backgroundColor: "#111114",
      boxShadow: "none",
    },
    ".Input:focus": {
      border: "1px solid #a078ff",
      boxShadow: "0 0 0 1px rgba(160, 120, 255, 0.24)",
    },
    ".Tab": {
      border: "1px solid rgba(255, 255, 255, 0.08)",
      backgroundColor: "#111114",
    },
    ".Tab--selected": {
      border: "1px solid #a078ff",
      backgroundColor: "rgba(160, 120, 255, 0.1)",
    },
    ".Label": {
      color: "rgba(255, 255, 255, 0.72)",
    },
  },
};

/* ── Inner form (must be inside <Elements>) ── */
function CheckoutForm() {
  const stripe = useStripe();
  const elements = useElements();
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsLoading(true);
    setMessage(null);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/return/`,
        receipt_email: email || undefined,
      },
    });

    // Only reaches here if there's an error (otherwise redirects)
    if (error) {
      if (error.type === "card_error" || error.type === "validation_error") {
        setMessage(error.message ?? "Payment failed.");
      } else {
        setMessage("An unexpected error occurred.");
      }
    }

    setIsLoading(false);
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ padding: "1.5rem 0", borderBottom: "1px solid var(--hairline)" }}>
        <span className="kicker" style={{ display: "block", marginBottom: "1rem" }}>Contact</span>
        <LinkAuthenticationElement onChange={(e) => setEmail(e.value.email)} />
      </div>

      <div style={{ padding: "1.5rem 0", borderBottom: "1px solid var(--hairline)" }}>
        <span className="kicker" style={{ display: "block", marginBottom: "1rem" }}>Shipping</span>
        <AddressElement
          options={{
            mode: "shipping",
            allowedCountries: ["US"],
            fields: { phone: "always" },
            validation: { phone: { required: "always" } },
          }}
        />
      </div>

      <div style={{ padding: "1.5rem 0", borderBottom: "1px solid var(--hairline)" }}>
        <span className="kicker" style={{ display: "block", marginBottom: "1rem" }}>Payment</span>
        <PaymentElement options={{ layout: "accordion" }} />
      </div>

      <button
        type="submit"
        disabled={isLoading || !stripe || !elements}
        className="btn btn-primary"
        style={{
          width: "100%",
          marginTop: "2rem",
          padding: "0.9rem 1.5rem",
          fontSize: "0.95rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
        }}
      >
        {isLoading ? (
          <>
            <span className="reg-spinner" /> Processing&hellip;
          </>
        ) : (
          "Pay now"
        )}
      </button>

      {message && (
        <div
          style={{
            marginTop: "1rem",
            padding: "0.75rem 1rem",
            background: "rgba(255, 77, 77, 0.1)",
            border: "1px solid rgba(255, 77, 77, 0.25)",
            borderRadius: "var(--radius-sm)",
            color: "#ff4d4d",
            fontSize: "0.85rem",
            textAlign: "center",
          }}
        >
          {message}
        </div>
      )}
    </form>
  );
}

/* ── Main page ── */
export default function CheckoutPage() {
  const { items } = useCart();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cartTotal = items.reduce((sum, item) => {
    const product = products.find((p) => p.id === item.productId);
    return sum + (product?.price ?? 0) * item.quantity;
  }, 0);

  useEffect(() => {
    if (items.length === 0) return;

    fetch("/api/checkout/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
        } else {
          setError(data.error || "Failed to initialize checkout.");
        }
      })
      .catch(() => setError("Network error. Please try again."));
  }, [items]);

  if (items.length === 0) {
    return (
      <main>
        <div className="page-header">
          <Container>
            <span className="kicker kicker-bright">Checkout</span>
            <h1 className="page-title mt-3">Your cart is empty</h1>
            <p className="page-sub mt-3">
              Add some items before checking out.
            </p>
            <div className="mt-6">
              <a href="/shop/" className="btn btn-primary">
                Browse shop &rarr;
              </a>
            </div>
          </Container>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="page-header">
        <Container>
          <span className="kicker kicker-bright">Secure Checkout</span>
          <h1 className="page-title mt-3">Complete your order</h1>
          <div className="section-rule mt-8" />
        </Container>
      </div>

      <section style={{ paddingBottom: "5rem" }}>
        <Container>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 380px",
              gap: "3rem",
              alignItems: "start",
            }}
            className="checkout-grid"
          >
            {/* ── Left: Payment form ── */}
            <div style={{ minHeight: 300 }}>
              {error && <div className="checkout-error">{error}</div>}
              {clientSecret ? (
                <Elements
                  stripe={stripePromise}
                  options={{ clientSecret, appearance }}
                >
                  <CheckoutForm />
                </Elements>
              ) : (
                !error && (
                  <div style={{ display: "flex", justifyContent: "center", padding: "4rem 0" }}>
                    <span className="reg-spinner" />
                  </div>
                )
              )}
            </div>

            {/* ── Right: Order summary ── */}
            <div>
              <div
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--hairline)",
                  borderRadius: "var(--radius-md)",
                  padding: "1.5rem",
                  position: "sticky",
                  top: 80,
                }}
              >
                <span className="kicker kicker-bright" style={{ display: "block", marginBottom: "1.25rem" }}>
                  Order Summary
                </span>

                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {items.map((item) => {
                    const product = products.find(
                      (p) => p.id === item.productId,
                    );
                    if (!product) return null;
                    return (
                      <li
                        key={`${item.productId}-${item.size}`}
                        style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
                      >
                        <div style={{ width: 56, height: 56, borderRadius: 8, overflow: "hidden", flexShrink: 0, background: "var(--bg-2)" }}>
                          {product.images[0] && (
                            <Image
                              src={product.images[0]}
                              alt={product.name}
                              width={56}
                              height={56}
                              style={{ objectFit: "cover" }}
                            />
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "0.88rem", fontWeight: 500, color: "var(--ink)" }}>
                            {product.name}
                          </div>
                          <div className="kicker" style={{ marginTop: 2 }}>
                            {item.size} &middot; Qty {item.quantity}
                          </div>
                        </div>
                        <span style={{ fontSize: "0.88rem", fontWeight: 500, color: "var(--ink-2)", flexShrink: 0 }}>
                          {formatPriceUSD((product.price ?? 0) * item.quantity)}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                <div style={{ height: 1, background: "var(--hairline)", margin: "1.25rem 0" }} />

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 600, color: "var(--ink)" }}>
                  <span>Total</span>
                  <span style={{ color: "var(--accent-solid)", fontSize: "1.1rem" }}>
                    {formatPriceUSD(cartTotal)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </main>
  );
}
