"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useCart } from "@/context/CartContext";
import type { Product } from "@/content/products";

export default function AddToCart({ product }: { product: Product }) {
  const { addItem } = useCart();
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const enter = useCallback(() => {
    if (timeout.current) clearTimeout(timeout.current);
    setOpen(true);
  }, []);

  const leave = useCallback(() => {
    timeout.current = setTimeout(() => setOpen(false), 300);
  }, []);

  useEffect(
    () => () => {
      if (timeout.current) clearTimeout(timeout.current);
      if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
    },
    [],
  );

  const canBuy = product.price != null && product.sizes.length > 0;

  if (!canBuy) {
    return (
      <div className="chip">
        <span className="dot" />
        Coming soon
      </div>
    );
  }

  function handleSizeClick(size: (typeof product.sizes)[number]) {
    addItem(product.id, size);
    setAdded(size);
    if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
    feedbackTimeout.current = setTimeout(() => setAdded(null), 1200);
  }

  return (
    <div
      className="atc-group"
      onMouseEnter={enter}
      onMouseLeave={leave}
    >
      <button className="btn btn-primary atc-trigger" type="button">
        {added ? `${added} added` : "Add to cart"}
      </button>

      <div className={`atc-sizes ${open ? "open" : ""}`}>
        <span className="atc-divider" />
        {product.sizes.map((size) => (
          <button
            key={size}
            className="atc-size"
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleSizeClick(size);
            }}
          >
            {size}
          </button>
        ))}
      </div>
    </div>
  );
}
