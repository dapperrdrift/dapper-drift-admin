import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { requireAdmin } from "../_shared/requireAdmin.ts";
import { fetchInvoiceData } from "../_shared/fetchInvoiceData.ts";
import { generateInvoicePdf } from "../_shared/generateInvoicePdf.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return jsonResponse({ error: auth.error }, auth.status);
    }

    const { orderId } = await req.json() as { orderId?: string };
    if (!orderId) {
      return jsonResponse({ error: "orderId is required" }, 400);
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return jsonResponse({ error: "RESEND_API_KEY is not configured" }, 500);
    }

    const result = await fetchInvoiceData(auth.serviceClient, orderId);
    if ("error" in result) {
      return jsonResponse({ error: result.error }, 404);
    }
    if (!result.email) {
      return jsonResponse({ error: "Order has no customer email on file" }, 400);
    }

    const pdfBytes = await generateInvoicePdf(result.invoice);
    const path = `${orderId}.pdf`;

    // Keep the stored copy in sync so the Download button always has the latest PDF.
    const { error: uploadError } = await auth.serviceClient.storage
      .from("invoices")
      .upload(path, pdfBytes, {
        contentType: "application/pdf",
        cacheControl: "3600",
        upsert: true,
      });
    if (uploadError) {
      return jsonResponse({ error: uploadError.message }, 500);
    }

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Dapperr Drift <invoices@dapperrdrift.com>",
        to: [result.email],
        subject: `Invoice for order ${result.invoice.orderNumber}`,
        html: `<p>Hi ${result.invoice.customerName},</p>
<p>Thank you for shopping with Dapperr Drift. Your invoice for order <strong>${result.invoice.orderNumber}</strong> is attached.</p>
<p>Order total: <strong>Rs. ${result.invoice.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></p>
<p>— Team Dapperr Drift</p>`,
        attachments: [
          {
            filename: `invoice-${result.invoice.orderNumber}.pdf`,
            content: toBase64(pdfBytes),
          },
        ],
      }),
    });

    if (!emailRes.ok) {
      const body = await emailRes.text();
      return jsonResponse({ error: `Resend API error: ${emailRes.status} ${body}` }, 502);
    }

    await auth.serviceClient
      .from("orders")
      .update({ invoice_sent_at: new Date().toISOString() })
      .eq("id", orderId);

    return jsonResponse({ path, sent: true }, 200);
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      500,
    );
  }
});
