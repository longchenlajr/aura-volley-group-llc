"use client";

import { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import Link from "next/link";
import Container from "@/components/Container";
import { useCart } from "@/context/CartContext";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
);

type Status = "loading" | "succeeded" | "processing" | "failed";

export default function CheckoutReturnPage() {
  const [status, setStatus] = useState<Status>("loading");
  const { clearCart } = useCart();

  useEffect(() => {
    const clientSecret = new URLSearchParams(window.location.search).get(
      "payment_intent_client_secret",
    );
    if (!clientSecret) {
      setStatus("failed");
      return;
    }

    stripePromise.then((stripe) => {
      if (!stripe) return;
      stripe.retrievePaymentIntent(clientSecret).then(({ paymentIntent }) => {
        if (!paymentIntent) {
          setStatus("failed");
          return;
        }
        if (paymentIntent.status === "succeeded") {
          setStatus("succeeded");
          clearCart();
        } else if (paymentIntent.status === "processing") {
          setStatus("processing");
        } else {
          setStatus("failed");
        }
      });
    });
  }, [clearCart]);

  return (
    <main>
      <div className="page-header">
        <Container>
          {status === "loading" && (
            <>
              <span className="kicker kicker-bright">Checkout</span>
              <h1 className="page-title mt-3">Processing&hellip;</h1>
              <div className="mt-8 flex justify-center">
                <span className="reg-spinner" />
              </div>
            </>
          )}

          {status === "succeeded" && (
            <>
              <span className="kicker kicker-bright">Order Confirmed</span>
              <h1 className="page-title mt-3">Thank you for your order!</h1>
              <p className="page-sub mt-3">
                You&rsquo;ll receive a confirmation email shortly.
              </p>
              <div className="mt-6">
                <Link href="/shop/" className="btn btn-primary">
                  Continue shopping &rarr;
                </Link>
              </div>
            </>
          )}

          {status === "processing" && (
            <>
              <span className="kicker kicker-bright">Processing</span>
              <h1 className="page-title mt-3">Payment processing</h1>
              <p className="page-sub mt-3">
                Your payment is being processed. We&rsquo;ll update you when
                it&rsquo;s complete.
              </p>
            </>
          )}

          {status === "failed" && (
            <>
              <span className="kicker kicker-bright">Checkout</span>
              <h1 className="page-title mt-3">Something went wrong</h1>
              <p className="page-sub mt-3">
                Your payment was not successful. Please try again.
              </p>
              <div className="mt-6">
                <Link href="/checkout/" className="btn btn-primary">
                  Try again &rarr;
                </Link>
              </div>
            </>
          )}
        </Container>
      </div>
    </main>
  );
}
