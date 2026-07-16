import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import type { InvoiceData } from "./generateInvoicePdf.ts";

interface ShippingAddress {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

export async function fetchInvoiceData(
  serviceClient: SupabaseClient,
  orderId: string,
): Promise<{ invoice: InvoiceData; email: string | null } | { error: string }> {
  const { data: order, error: orderError } = await serviceClient
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    return { error: "Order not found" };
  }

  const { data: items, error: itemsError } = await serviceClient
    .from("order_items")
    .select("quantity, unit_price, line_total, variants(sku, color, size, products(name))")
    .eq("order_id", orderId);

  if (itemsError) {
    return { error: itemsError.message };
  }

  const addr = (order.shipping_address ?? {}) as ShippingAddress;
  const customerName = [addr.firstName, addr.lastName].filter(Boolean).join(" ") || "Customer";
  const addressLines = [
    addr.addressLine1,
    addr.addressLine2,
    [addr.city, addr.state, addr.pincode].filter(Boolean).join(", "),
  ].filter((line): line is string => Boolean(line && line.trim()));

  const subtotal = Number(order.total_amount) - Number(order.shipping_fee) + Number(order.discount_amount);

  const invoice: InvoiceData = {
    orderNumber: order.order_number || order.id.slice(0, 8),
    createdAt: order.created_at,
    status: order.status,
    customerName,
    customerEmail: addr.email ?? null,
    customerPhone: addr.phone ?? null,
    shippingAddressLines: addressLines,
    items: (items ?? []).map((item) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const variant = item.variants as any;
      const variantLabel = [variant?.color, variant?.size].filter((v) => v && v !== "Default").join(" / ");
      return {
        productName: variant?.products?.name ?? "Product",
        variantLabel,
        sku: variant?.sku ?? "",
        quantity: item.quantity,
        unitPrice: Number(item.unit_price),
        lineTotal: Number(item.line_total),
      };
    }),
    subtotal,
    discountAmount: Number(order.discount_amount),
    shippingFee: Number(order.shipping_fee),
    totalAmount: Number(order.total_amount),
    trackingId: order.tracking_id,
    carrierName: order.carrier_name,
  };

  return { invoice, email: addr.email ?? null };
}
