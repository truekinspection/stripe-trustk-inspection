import { NextResponse } from "next/server";

import {
  getStripeServer,
  REPORT_CURRENCY,
  REPORT_PRICE_CENTS,
} from "@/lib/stripe-server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const firstName =
      typeof body.firstName === "string" ? body.firstName.trim() : "";
    const lastName =
      typeof body.lastName === "string" ? body.lastName.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const vin = typeof body.vin === "string" ? body.vin.trim() : "";

    if (!firstName || !lastName || !email || !vin) {
      return NextResponse.json(
        { success: false, message: "Missing required fields." },
        { status: 400 },
      );
    }

    if (!process.env.STRIPE_SECRET_KEY?.trim()) {
      return NextResponse.json(
        { success: false, message: "Stripe is not configured." },
        { status: 500 },
      );
    }

    const stripe = getStripeServer();

    const paymentIntent = await stripe.paymentIntents.create({
      amount: REPORT_PRICE_CENTS,
      currency: REPORT_CURRENCY,
      automatic_payment_methods: { enabled: true },
      receipt_email: email,
      description: "TrustK Inspection — Full vehicle history report",
      metadata: {
        vin,
        firstName,
        lastName,
        email,
      },
    });

    if (!paymentIntent.client_secret) {
      return NextResponse.json(
        { success: false, message: "Could not create payment intent." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("[create-payment-intent]", err.message || error);
    return NextResponse.json(
      {
        success: false,
        message: "Could not create payment intent.",
        details: err.message,
      },
      { status: 500 },
    );
  }
}
