const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

export const profileTypeForDocument = (documentType) =>
  ({
    TICKET: "SALE_TICKET",
    BON_POUR: "SALE_INVOICE",
    SALES_INVOICE: "SALE_INVOICE",
    DELIVERY_NOTE: "SHIPPING_INVOICE",
  })[documentType] || "SALE_INVOICE";

export function buildSalePrintHtml(sale, options = {}) {
  const documentType = options.document_type || "BON_POUR",
    config = options.configuration || {},
    format = options.paper_format || "A4";
  const thermal = ["THERMAL_80", "THERMAL_58"].includes(format),
    width =
      format === "THERMAL_58"
        ? "58mm"
        : format === "THERMAL_80"
          ? "80mm"
          : format === "A5"
            ? "148mm"
            : "210mm";
  const title =
    config.title?.trim() ||
    {
      TICKET: "Ticket",
      BON_POUR: "Bon pour",
      SALES_INVOICE: "Bon pour",
      DELIVERY_NOTE: "Bon de livraison",
    }[documentType] ||
    "Vente";
  const returnTotal = Number(sale.return_summary?.return_total || 0),
    net = Number(sale.total || 0) - returnTotal;
  const warehouseLines = [
    config.show_warehouse_name && sale.warehouse_name,
    config.show_address && sale.warehouse_address,
    config.show_phone && sale.warehouse_phone && `Tél: ${sale.warehouse_phone}`,
    config.show_email && sale.warehouse_email && `Email: ${sale.warehouse_email}`,
    config.show_legal_info &&
      sale.warehouse_nif &&
      `NIF: ${sale.warehouse_nif}`,
    config.show_legal_info &&
      sale.warehouse_nis &&
      `NIS: ${sale.warehouse_nis}`,
    config.show_legal_info &&
      sale.warehouse_rib &&
      `RIB: ${sale.warehouse_rib}`,
    config.show_legal_info &&
      sale.warehouse_tax_article &&
      `Article: ${sale.warehouse_tax_article}`,
    config.show_legal_info &&
      sale.warehouse_commercial_register &&
      `RC: ${sale.warehouse_commercial_register}`,
    config.show_legal_info &&
      sale.warehouse_business_activity &&
      `Activité: ${sale.warehouse_business_activity}`,
  ].filter(Boolean);
  const customerLines = config.show_customer && sale.customer_name
    ? [
        `${config.party_label || "Client"}: ${sale.customer_name}`,
        sale.customer_address && `Adresse: ${sale.customer_address}`,
        sale.customer_phone && `Tél: ${sale.customer_phone}`,
        sale.customer_email && `Email: ${sale.customer_email}`,
        sale.customer_nif && `NIF: ${sale.customer_nif}`,
        sale.customer_nis && `NIS: ${sale.customer_nis}`,
        sale.customer_rib && `RIB: ${sale.customer_rib}`,
        sale.customer_tax_article && `Article: ${sale.customer_tax_article}`,
        sale.customer_commercial_register && `RC: ${sale.customer_commercial_register}`,
        sale.customer_business_activity && `Activité: ${sale.customer_business_activity}`,
      ].filter(Boolean)
    : [];
  const sourceTotal = (sale.lines || []).reduce((sum, line) => sum + Number(line.total || 0), 0);
  const netFactor = config.show_discounts === false && sourceTotal > 0
    ? Number(sale.total || 0) / sourceTotal
    : 1;
  let allocatedBefore = 0;
  let allocatedAfter = 0;
  const printedLineTotals = (sale.lines || []).map((line) => {
    allocatedBefore += Number(line.total || 0);
    const cumulativeNet = Math.round(allocatedBefore * netFactor * 100) / 100;
    const amount = Math.round((cumulativeNet - allocatedAfter) * 100) / 100;
    allocatedAfter = cumulativeNet;
    return amount;
  });
  const rows = (sale.lines || [])
    .map(
      (line, index) =>
        `<tr><td>${config.show_product_reference && line.reference ? `<small>${escapeHtml(line.reference)}</small><br>` : ""}${escapeHtml(line.designation)}${config.show_discounts === true && Number(line.discount_value || 0) ? `<small> (-${escapeHtml(line.discount_value)}${line.discount_type === "PERCENT" ? "%" : " DA"})</small>` : ""}</td><td class="n">${escapeHtml(line.quantity)}</td><td class="n">${Number(config.show_discounts === false ? printedLineTotals[index] / Number(line.quantity || 1) : line.unit_price || 0).toFixed(2)}</td><td class="n">${Number(printedLineTotals[index]).toFixed(2)}</td></tr>`,
    )
    .join("");
  const payments =
    config.show_payment_details && sale.payments?.length
      ? `<section class="payments">${sale.payments.map((p) => `<div class="meta"><span>${escapeHtml(p.payment_method_name || p.payment_method_code)}</span><b>${Number(p.amount || 0).toFixed(2)} DA</b></div>`).join("")}</section>`
      : "";
  return `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:${thermal ? `${width} auto` : format};margin:${thermal ? "3mm" : "12mm"}}*{box-sizing:border-box}html,body{margin:0;padding:0}body{margin:0 auto;width:${width};max-width:100%;padding:${thermal ? "3mm" : "8mm"};font-family:Arial,sans-serif;color:#111;font-size:${thermal ? "10px" : "12px"}}img.print-logo{display:block;max-width:35mm;max-height:18mm;object-fit:contain;margin:0 auto 7px}h1{text-align:center;font-size:${thermal ? "15px" : "21px"};margin:0 0 5px}.warehouse{text-align:center;line-height:1.45;margin-bottom:10px}.party{margin:8px 0;padding:6px 0;border-top:1px solid #aaa;border-bottom:1px solid #aaa;line-height:1.45}.meta{display:flex;justify-content:space-between;gap:10px;margin:4px 0}table{width:100%;border-collapse:collapse;margin-top:12px;break-inside:auto}thead{display:table-header-group}tbody{break-inside:auto}tr{break-inside:avoid}th,td{padding:6px 4px;border-bottom:1px solid #bbb;text-align:left}.n{text-align:right}.totals{margin:14px 0 0 auto;max-width:320px}.total{display:flex;justify-content:space-between;padding:5px 0;font-weight:bold}.net{border-top:2px solid #111;font-size:1.12em}.payments{margin-top:10px;border-top:1px solid #aaa;padding-top:6px}.footer{text-align:center;margin-top:18px;font-size:.9em;white-space:pre-wrap}</style></head><body>${config.show_logo && options.logo_data ? `<img class="print-logo" src="${escapeHtml(options.logo_data)}" alt="Logo">` : ""}<h1>${escapeHtml(title)}</h1>${warehouseLines.length ? `<div class="warehouse">${warehouseLines.map(escapeHtml).join("<br>")}</div>` : ""}<div class="meta"><b>${escapeHtml(sale.sale_number)}</b><span>${escapeHtml(sale.sale_date || "")}</span></div>${customerLines.length ? `<div class="party">${customerLines.map(escapeHtml).join("<br>")}</div>` : ""}${config.show_cashier && sale.seller_name ? `<div class="meta"><span>Caissier</span><b>${escapeHtml(sale.seller_name)}</b></div>` : ""}${config.show_cash_register && sale.cash_register_name ? `<div class="meta"><span>Caisse</span><b>${escapeHtml(sale.cash_register_name)}</b></div>` : ""}<table><thead><tr><th>Article</th><th class="n">Qté</th><th class="n">Prix</th><th class="n">Montant</th></tr></thead><tbody>${rows}</tbody></table><div class="totals"><div class="total"><span>Total vente</span><span>${Number(sale.total || 0).toFixed(2)} DA</span></div>${returnTotal ? `<div class="total"><span>Retours</span><span>-${returnTotal.toFixed(2)} DA</span></div><div class="total net"><span>Net après retours</span><span>${net.toFixed(2)} DA</span></div>` : ""}</div>${payments}${config.footer_message ? `<div class="footer">${escapeHtml(config.footer_message)}</div>` : ""}</body></html>`;
}
