import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

export interface InvoiceLineItem {
  productName: string;
  variantLabel: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface InvoiceData {
  orderNumber: string;
  createdAt: string;
  status: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  shippingAddressLines: string[];
  items: InvoiceLineItem[];
  subtotal: number;
  discountAmount: number;
  shippingFee: number;
  totalAmount: number;
  trackingId: string | null;
  carrierName: string | null;
}

const PAGE_WIDTH = 595.28; // A4 pt
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;

function formatCurrency(amount: number): string {
  return `Rs. ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function generateInvoicePdf(invoice: InvoiceData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const drawText = (text: string, x: number, size: number, useBold = false, color = rgb(0, 0, 0)) => {
    page.drawText(text, { x, y, size, font: useBold ? boldFont : font, color });
  };

  const newPageIfNeeded = (needed: number) => {
    if (y - needed < MARGIN) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  };

  // Header
  drawText("Dapperr Drift", MARGIN, 20, true);
  y -= 26;
  drawText("Tax Invoice", MARGIN, 12, false, rgb(0.4, 0.4, 0.4));
  y -= 30;

  // Order meta (right-aligned block)
  const metaX = PAGE_WIDTH - MARGIN - 220;
  page.drawText(`Order: ${invoice.orderNumber}`, { x: metaX, y: y + 30, size: 10, font: boldFont });
  page.drawText(`Date: ${new Date(invoice.createdAt).toLocaleDateString("en-IN")}`, { x: metaX, y: y + 16, size: 10, font });
  page.drawText(`Status: ${invoice.status}`, { x: metaX, y: y + 2, size: 10, font });

  // Bill to
  drawText("Bill To", MARGIN, 11, true);
  y -= 16;
  drawText(invoice.customerName || "Customer", MARGIN, 10);
  y -= 14;
  if (invoice.customerEmail) { drawText(invoice.customerEmail, MARGIN, 10); y -= 14; }
  if (invoice.customerPhone) { drawText(invoice.customerPhone, MARGIN, 10); y -= 14; }
  for (const line of invoice.shippingAddressLines) {
    drawText(line, MARGIN, 10);
    y -= 14;
  }
  y -= 10;

  // Table header
  const colProduct = MARGIN;
  const colQty = MARGIN + 300;
  const colUnit = MARGIN + 350;
  const colTotal = MARGIN + 440;

  page.drawRectangle({
    x: MARGIN, y: y - 4, width: PAGE_WIDTH - MARGIN * 2, height: 20,
    color: rgb(0.95, 0.95, 0.95),
  });
  page.drawText("Item", { x: colProduct + 4, y, size: 10, font: boldFont });
  page.drawText("Qty", { x: colQty, y, size: 10, font: boldFont });
  page.drawText("Unit Price", { x: colUnit, y, size: 10, font: boldFont });
  page.drawText("Total", { x: colTotal, y, size: 10, font: boldFont });
  y -= 24;

  for (const item of invoice.items) {
    newPageIfNeeded(30);
    page.drawText(`${item.productName}${item.variantLabel ? ` (${item.variantLabel})` : ""}`, {
      x: colProduct + 4, y, size: 9, font, maxWidth: colQty - colProduct - 10,
    });
    page.drawText(String(item.quantity), { x: colQty, y, size: 9, font });
    page.drawText(formatCurrency(item.unitPrice), { x: colUnit, y, size: 9, font });
    page.drawText(formatCurrency(item.lineTotal), { x: colTotal, y, size: 9, font });
    y -= 16;
    page.drawText(`SKU: ${item.sku}`, { x: colProduct + 4, y, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
    y -= 18;
  }

  newPageIfNeeded(100);
  y -= 10;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 1, color: rgb(0.85, 0.85, 0.85) });
  y -= 20;

  const totalsX = PAGE_WIDTH - MARGIN - 180;
  const drawTotal = (label: string, value: string, bold = false) => {
    page.drawText(label, { x: totalsX, y, size: 10, font: bold ? boldFont : font });
    page.drawText(value, { x: totalsX + 110, y, size: 10, font: bold ? boldFont : font });
    y -= 16;
  };
  drawTotal("Subtotal", formatCurrency(invoice.subtotal));
  drawTotal("Discount", `- ${formatCurrency(invoice.discountAmount)}`);
  drawTotal("Shipping", formatCurrency(invoice.shippingFee));
  drawTotal("Total", formatCurrency(invoice.totalAmount), true);

  if (invoice.trackingId) {
    y -= 10;
    drawText(`Tracking ID: ${invoice.trackingId}${invoice.carrierName ? ` (${invoice.carrierName})` : ""}`, MARGIN, 9, false, rgb(0.4, 0.4, 0.4));
  }

  return pdfDoc.save();
}
