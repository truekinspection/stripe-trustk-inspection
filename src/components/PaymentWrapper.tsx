"use client";

import { useEffect, useState } from "react";
import { Elements } from "@stripe/react-stripe-js";
import { Loader2 } from "lucide-react";

import { CheckoutForm } from "@/components/CheckoutForm";
import { stripePromise } from "@/lib/stripe";

type PaymentWrapperProps = {
  firstName: string;
  lastName: string;
  email: string;
  vin: string;
  /** When true, creates a PaymentIntent and mounts Elements. */
  enabled: boolean;
  onSuccess: (paymentIntentId: string) => void | Promise<void>;
};

export function PaymentWrapper({
  firstName,
  lastName,
  email,
  vin,
  enabled,
  onSuccess,
}: PaymentWrapperProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setClientSecret(null);
      setLoadError(null);
      setLoading(false);
      return;
    }

    const fn = firstName.trim();
    const ln = lastName.trim();
    const em = email.trim();
    const v = vin.trim();

    if (!fn || !ln || !em || !v) {
      setClientSecret(null);
      setLoadError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    // Debounce so typing name/email does not create a PaymentIntent per keystroke.
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch("/api/create-payment-intent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              firstName: fn,
              lastName: ln,
              email: em,
              vin: v,
            }),
          });
          const json = (await res.json()) as {
            success?: boolean;
            clientSecret?: string;
            message?: string;
          };
          if (cancelled) return;
          if (!res.ok || !json.clientSecret) {
            setClientSecret(null);
            setLoadError(
              typeof json.message === "string"
                ? json.message
                : "Could not start checkout.",
            );
            return;
          }
          setClientSecret(json.clientSecret);
        } catch (e) {
          console.error("[PaymentWrapper]", e);
          if (!cancelled) {
            setClientSecret(null);
            setLoadError("Could not start checkout. Please try again.");
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 500);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enabled, firstName, lastName, email, vin]);

  if (!enabled) return null;

  if (!firstName.trim() || !lastName.trim() || !email.trim()) {
    return (
      <p className="text-sm text-muted-foreground pt-2">
        Enter your name and email to continue to secure checkout.
      </p>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-600">
        <Loader2 className="h-5 w-5 animate-spin text-custom_red" />
        Preparing secure checkout…
      </div>
    );
  }

  if (loadError) {
    return (
      <p className="text-sm text-destructive pt-2" role="alert">
        {loadError}
      </p>
    );
  }

  if (!clientSecret) return null;

  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    return (
      <p className="text-sm text-destructive">
        Stripe is not configured. Please contact support.
      </p>
    );
  }

  return (
    <Elements
      key={clientSecret}
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: "stripe",
        },
      }}
    >
      <CheckoutForm customerEmail={email.trim()} onSuccess={onSuccess} />
    </Elements>
  );
}
