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

    const result = await fetchInvoiceData(auth.serviceClient, orderId);
    if ("error" in result) {
      return jsonResponse({ error: result.error }, 404);
    }

    const pdfBytes = await generateInvoicePdf(result.invoice);
    const path = `${orderId}.pdf`;

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

    return jsonResponse({ path }, 200);
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      500,
    );
  }
});
