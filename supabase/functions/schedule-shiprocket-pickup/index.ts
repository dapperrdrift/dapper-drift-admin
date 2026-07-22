import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SHIPROCKET_BASE = "https://apiv2.shiprocket.in/v1/external";

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getShiprocketToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;
  const res = await fetch(`${SHIPROCKET_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: Deno.env.get("SHIPROCKET_EMAIL"),
      password: Deno.env.get("SHIPROCKET_PASSWORD"),
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Shiprocket auth failed: ${res.status} — ${body}`);
  }
  const data = await res.json();
  cachedToken = data.token as string;
  tokenExpiresAt = Date.now() + 23 * 60 * 60 * 1000;
  return cachedToken;
}

interface ShippingAddress {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

/** Creates an adhoc Shiprocket order from a DB order row and returns its ids. */
// deno-lint-ignore no-explicit-any
async function createShiprocketOrder(token: string, order: any): Promise<{ order_id: number; shipment_id: number }> {
  const addr = (order.shipping_address ?? {}) as ShippingAddress;

  const orderDate = new Date(order.created_at)
    .toISOString()
    .replace("T", " ")
    .slice(0, 16); // "YYYY-MM-DD HH:MM"

  // deno-lint-ignore no-explicit-any
  const srItems = (order.order_items as any[]).map((item) => ({
    name: item.variants?.products?.name ?? "Item",
    sku: item.variants?.sku ?? String(item.variant_id ?? "SKU"),
    units: item.quantity,
    selling_price: item.unit_price,
  }));

  const payload = {
    order_id: order.order_number ?? order.id,
    order_date: orderDate,
    pickup_location: Deno.env.get("SHIPROCKET_PICKUP_LOCATION") ?? "Primary",
    billing_customer_name: addr.firstName ?? "Customer",
    billing_last_name: addr.lastName ?? "",
    billing_address: addr.address ?? "",
    billing_city: addr.city ?? "",
    billing_pincode: addr.pincode ?? "",
    billing_state: addr.state ?? "",
    billing_country: "India",
    billing_email: addr.email ?? "",
    billing_phone: addr.phone ?? "",
    shipping_is_billing: true,
    order_items: srItems,
    payment_method: "Prepaid",
    sub_total: Number(order.total_amount) - Number(order.shipping_fee ?? 0),
    length: 30,
    breadth: 25,
    height: 5,
    weight: 0.5,
  };

  const res = await fetch(`${SHIPROCKET_BASE}/orders/create/adhoc`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || !data?.shipment_id) {
    throw new Error(`Shiprocket order creation failed: ${res.status} — ${JSON.stringify(data)}`);
  }
  return { order_id: data.order_id, shipment_id: data.shipment_id };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1. Authenticate the caller and confirm they are an admin.
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return json({ error: "Unauthorized: missing session token" }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    const user = userData?.user;
    if (userErr || !user) {
      return json({ error: "Unauthorized: invalid or expired session" }, 401);
    }

    const adminDb = createClient(supabaseUrl, serviceKey);

    const { data: roleRow } = await adminDb
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return json({ error: "Forbidden: admin role required" }, 403);
    }

    // 2. Read the order.
    const { orderId } = (await req.json()) as { orderId?: string };
    if (!orderId) {
      return json({ error: "orderId is required" }, 400);
    }

    const { data: order, error: fetchError } = await adminDb
      .from("orders")
      .select(`
        id, order_number, created_at, total_amount, shipping_fee, shipping_address,
        shiprocket_order_id, shiprocket_shipment_id,
        order_items ( quantity, unit_price, variant_id, variants ( sku, products ( name ) ) )
      `)
      .eq("id", orderId)
      .single();

    if (fetchError || !order) {
      return json({ error: "Order not found" }, 404);
    }

    // deno-lint-ignore no-explicit-any
    let shipmentId = (order as any).shiprocket_shipment_id as string | null;

    const srToken = await getShiprocketToken();

    // 3. If the order was never pushed to Shiprocket, create it now (auto-create fallback).
    if (!shipmentId) {
      const created = await createShiprocketOrder(srToken, order);
      shipmentId = String(created.shipment_id);
      await adminDb
        .from("orders")
        .update({
          shiprocket_order_id: String(created.order_id),
          shiprocket_shipment_id: shipmentId,
          // deno-lint-ignore no-explicit-any
        } as any)
        .eq("id", order.id);
    }

    // 4. Assign AWB (courier).
    const awbRes = await fetch(`${SHIPROCKET_BASE}/courier/assign/awb`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${srToken}` },
      body: JSON.stringify({ shipment_id: shipmentId }),
    });
    const awbData = await awbRes.json();
    if (!awbRes.ok) {
      return json({ error: "AWB assignment failed", details: awbData }, 502);
    }

    // Persist AWB / courier details if returned.
    const awbCode = awbData?.response?.data?.awb_code ?? null;
    const courierName = awbData?.response?.data?.courier_name ?? null;
    if (awbCode) {
      await adminDb
        .from("orders")
        .update({ tracking_id: String(awbCode), carrier_name: courierName })
        .eq("id", order.id);
    }

    // 5. Schedule pickup.
    const pickupRes = await fetch(`${SHIPROCKET_BASE}/courier/generate/pickup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${srToken}` },
      body: JSON.stringify({ shipment_id: [shipmentId] }),
    });
    const pickupData = await pickupRes.json();

    return json({ success: true, shipment_id: shipmentId, awb: awbData, pickup: pickupData });
  } catch (err) {
    console.error("schedule-shiprocket-pickup error:", err);
    return json({ error: String(err instanceof Error ? err.message : err) }, 500);
  }
});
