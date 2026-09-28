"use client";

import { FormEvent, useState } from "react";
import {
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { REPORT_PRICE_DISPLAY } from "@/lib/constants";

type CheckoutFormProps = {
  customerEmail: string;
  onSuccess: (paymentIntentId: string) => void | Promise<void>;
};

export function CheckoutForm({ customerEmail, onSuccess }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
        confirmParams: {
          receipt_email: customerEmail || undefined,
          return_url:
            typeof window !== "undefined"
              ? `${window.location.origin}/check-vin`
              : undefined,
        },
      });

      if (error) {
        setErrorMessage(
          error.message || "Payment could not be completed. Please try again.",
        );
        return;
      }

      if (paymentIntent?.status === "succeeded" && paymentIntent.id) {
        await onSuccess(paymentIntent.id);
        return;
      }

      setErrorMessage(
        "Payment did not complete. Please try again or use a different card.",
      );
    } catch (e) {
      console.error("[CheckoutForm]", e);
      setErrorMessage("An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement
        options={{
          layout: "tabs",
        }}
      />
      {errorMessage ? (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={!stripe || !elements || submitting}
        className="w-full bg-custom_red/80 hover:bg-custom_red text-white"
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing…
          </>
        ) : (
          `Pay ${REPORT_PRICE_DISPLAY}`
        )}
      </Button>
    </form>
  );
}
