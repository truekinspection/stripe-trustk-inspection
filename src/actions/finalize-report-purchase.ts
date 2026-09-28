"use server";

import { randomBytes } from "crypto";
import db from "@/lib/db";
import { buildReportDeliveryEmailHtml } from "@/lib/emails/templates";
import { createResendClient, getResendFrom } from "@/lib/emails/resend-config";
import { sendOwnerCopy } from "@/lib/emails/send-owner-copy";
import { computeReportPreviewExpiry } from "@/lib/report-preview-access";
import { REPORT_PRICE_DISPLAY } from "@/lib/constants";
import { getStripeServer } from "@/lib/stripe-server";

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

function appOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_URL ||
    "https://www.trustkinspection.com";
  return raw.replace(/\/+$/, "");
}

function splitCustomerName(displayName: string): {
  firstName: string;
  lastName: string;
} {
  const t = displayName.trim();
  if (!t) return { firstName: "Customer", lastName: "" };
  const parts = t.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0]!, lastName: "" };
  return {
    firstName: parts[0]!,
    lastName: parts.slice(1).join(" "),
  };
}

async function verifyStripePaymentIntent(
  paymentIntentId: string,
): Promise<{ ok: true; transactionId: string } | { ok: false; error: string }> {
  const id = paymentIntentId.trim();
  if (!id) {
    return { ok: false, error: "Missing payment reference." };
  }

  try {
    const stripe = getStripeServer();
    const intent = await stripe.paymentIntents.retrieve(id);
    if (intent.status !== "succeeded") {
      return {
        ok: false,
        error: `Payment is not complete (status: ${intent.status}).`,
      };
    }
    return { ok: true, transactionId: intent.id };
  } catch (e) {
    console.error("[finalizeReportPurchase] Stripe verify failed", e);
    return { ok: false, error: "Could not verify payment with Stripe." };
  }
}

export type FinalizeReportPurchaseInput = {
  html: string;
  vin: string;
  clearvinReportId?: string | null;
  customerEmail: string;
  customerDisplayName: string;
  /** Stripe PaymentIntent id (pi_…). */
  stripePaymentIntentId: string;
  vehicleYear?: string;
  vehicleMake?: string;
  vehicleModel?: string;
};

/**
 * After successful Stripe payment: verify PaymentIntent, persist payment +
 * report token, then send purchase/report email to customer and owner
 * (DB first — no emails on DB failure).
 */
export async function finalizeReportPurchase(
  input: FinalizeReportPurchaseInput,
): Promise<{ success: true; token: string } | { success: false; error: string }> {
  const email = input.customerEmail.trim();
  if (!email) {
    return { success: false, error: "Customer email is required." };
  }
  if (!input.html?.trim()) {
    return { success: false, error: "Report HTML is missing." };
  }
  if (!input.vin?.trim()) {
    return { success: false, error: "VIN is required." };
  }

  const verified = await verifyStripePaymentIntent(input.stripePaymentIntentId);
  if (!verified.ok) {
    return { success: false, error: verified.error };
  }
  const transactionId = verified.transactionId;

  const { firstName, lastName } = splitCustomerName(input.customerDisplayName);

  const token = generateToken();
  const expiresAt = computeReportPreviewExpiry();
  const reportIdStr = input.clearvinReportId?.trim() || null;

  try {
    await db.$transaction(
      async (tx) => {
        await tx.reportPreviewToken.create({
          data: {
            token,
            html: input.html,
            vin: input.vin.trim(),
            clearvinReportId: reportIdStr,
            expiresAt,
          },
        });
        await tx.payment.create({
          data: {
            firstName,
            lastName,
            email,
            plan: `Vehicle History Report — ${REPORT_PRICE_DISPLAY}`,
            orderID: transactionId,
            status: "COMPLETED",
          },
        });
      },
      {
        maxWait: 20_000,
        timeout: 30_000,
      },
    );
  } catch (e) {
    console.error("[finalizeReportPurchase] DB transaction failed", e);
    return {
      success: false,
      error: "We could not save your order. Please contact support.",
    };
  }

  const origin = appOrigin();
  const reportUrl = `${origin}/report-preview?token=${encodeURIComponent(token)}&vin=${encodeURIComponent(input.vin.trim())}`;
  const resend = createResendClient();
  const from = getResendFrom();

  if (resend) {
    const customerLabel =
      [firstName, lastName].filter(Boolean).join(" ").trim() || "Customer";
    const vinTrimmed = input.vin.trim();
    const emailHtml = buildReportDeliveryEmailHtml({
      customerName: customerLabel,
      reportUrl,
      vin: vinTrimmed,
      reportId: reportIdStr,
      transactionId,
      customerEmail: email,
      vehicleYear: input.vehicleYear,
      vehicleMake: input.vehicleMake,
      vehicleModel: input.vehicleModel,
    });

    try {
      await resend.emails.send({
        from,
        to: email,
        subject: "Your vehicle history report — TrustK Inspection",
        html: emailHtml,
      });
    } catch (e) {
      console.error("[finalizeReportPurchase] customer report email", e);
    }

    await sendOwnerCopy(resend, {
      customerEmail: email,
      subject: `[TrustK] Purchase complete — ${vinTrimmed}`,
      html: buildReportDeliveryEmailHtml({
        customerName: customerLabel,
        reportUrl,
        vin: vinTrimmed,
        reportId: reportIdStr,
        transactionId,
        customerEmail: email,
        vehicleYear: input.vehicleYear,
        vehicleMake: input.vehicleMake,
        vehicleModel: input.vehicleModel,
        forOwner: true,
      }),
      logContext: "finalizeReportPurchase",
    });
  } else {
    console.warn("[finalizeReportPurchase] RESEND_API_KEY not set; skipping emails.");
  }

  void db.reportPreviewToken
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(() => {});

  return { success: true, token };
}
