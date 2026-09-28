import { loadStripe } from "@stripe/stripe-js";

/**
 * Client-side Stripe.js instance (publishable key only).
 * Never import STRIPE_SECRET_KEY here.
 */
export const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
);
