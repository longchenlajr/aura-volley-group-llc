import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { products } from "@/content/products";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

type CartLine = {
  productId: string;
  size: string;
  quantity: number;
};

export async function POST(req: NextRequest) {
  try {
    const { items } = (await req.json()) as { items: CartLine[] };

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    // Calculate total from server-side product data (never trust client prices)
    let totalAmount = 0;
    const description: string[] = [];

    for (const item of items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product || product.price == null) continue;

      totalAmount += Math.round(product.price * 100) * item.quantity;
      description.push(`${product.name} (${item.size}) x${item.quantity}`);
    }

    if (totalAmount <= 0) {
      return NextResponse.json({ error: "No valid items" }, { status: 400 });
    }

    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      metadata: {
        order_items: description.join(", "),
      },
    });

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error("Stripe PaymentIntent error:", err);
    return NextResponse.json(
      { error: "Failed to create payment intent" },
      { status: 500 },
    );
  }
}
