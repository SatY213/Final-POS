const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
  );

const date = (value) => {
  if (!value) return "-";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : esc(value);
};

const money = (value) =>
  `${Number(value || 0).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} DA`;

const row = (label, value) =>
  value ? `<div class="row"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>` : "";

export function buildWarrantyPrintHtml(warranty, profile = {}) {
  const config = profile.configuration || {};
  const title = config.title || "BON DE GARANTIE";
  const duration = `${warranty.duration_value} ${warranty.duration_unit === "MONTHS" ? "mois" : "jour(s)"}`;
  const product = [warranty.product_nature, warranty.product_brand, warranty.product_model]
    .filter(Boolean)
    .join(" · ");
  const pageSize = profile.paper_format === "A5" ? "A5" : "A4";
  const pageHeight = pageSize === "A5" ? 210 : 297;
  const sourceType = warranty.source_type || (warranty.invoice_reference ? "INVOICE" : "SALE");
  const sourceReference = warranty.source_reference || warranty.invoice_reference || "Non liée";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page{size:${pageSize};margin:12mm}*{box-sizing:border-box}html{width:100%;min-height:100%;overflow:hidden;background:#e5e7eb}body{margin:0;color:#111;font-family:Arial,sans-serif;font-size:11px;background:transparent}.print-page{min-height:${pageHeight}mm;padding:12mm;background:#fff;box-shadow:0 1px 5px rgba(0,0,0,.16)}
    .header{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #111;padding-bottom:14px}.logo{max-width:145px;max-height:62px;object-fit:contain}.company{font-size:11px;line-height:1.55}.company-name{font-size:18px;font-weight:800;margin-bottom:5px}
    .document{text-align:right}.document h1{font-size:22px;margin:0 0 8px}.number{font-size:13px;font-weight:800}.dates{margin-top:8px;color:#444;line-height:1.6}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px}.box{border:1px solid #bbb;padding:12px}.box h2{font-size:11px;letter-spacing:.08em;margin:0 0 10px;padding-bottom:7px;border-bottom:1px solid #ddd}.row{display:flex;justify-content:space-between;gap:12px;margin:6px 0}.row span{color:#666}.row strong{text-align:right}
    .product{margin-top:12px;border:1px solid #999}.product-title{background:#f2f3f4;padding:9px 12px;font-size:12px;font-weight:800}.product-body{padding:12px}.product-name{font-size:15px;font-weight:800;margin-bottom:9px}.price{margin-top:12px;padding-top:10px;border-top:1px solid #ddd;font-size:14px;text-align:right}
    .warranty{margin-top:12px;border:2px solid #111;padding:12px;display:grid;grid-template-columns:repeat(3,1fr);gap:12px;text-align:center}.warranty span{display:block;color:#666;font-size:10px;margin-bottom:5px}.warranty strong{font-size:14px}
    .note{margin-top:12px;border:1px solid #bbb;padding:12px;min-height:58px;white-space:pre-wrap}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:50px;margin-top:34px;text-align:center}.signature{border-top:1px solid #444;padding-top:7px}.footer{margin-top:22px;text-align:center;color:#666;font-size:9px}@media print{html,body{min-height:0;overflow:visible;background:#fff}.print-page{min-height:0;padding:0;box-shadow:none}}
  </style></head><body><section class="print-page">
    <header class="header"><div>${config.show_logo && profile.logo_data ? `<img class="logo" src="${esc(profile.logo_data)}" alt="Logo">` : ""}${config.show_warehouse_name !== false ? `<div class="company-name">${esc(warranty.warehouse_name)}</div>` : ""}<div class="company">${config.show_address !== false && warranty.warehouse_address ? `${esc(warranty.warehouse_address)}<br>` : ""}${config.show_phone !== false && warranty.warehouse_phone ? `Tél. ${esc(warranty.warehouse_phone)}<br>` : ""}${config.show_email !== false && warranty.warehouse_email ? `${esc(warranty.warehouse_email)}<br>` : ""}${config.show_legal_info !== false ? [warranty.warehouse_nif && `NIF ${esc(warranty.warehouse_nif)}`, warranty.warehouse_nis && `NIS ${esc(warranty.warehouse_nis)}`, warranty.warehouse_rib && `RIB ${esc(warranty.warehouse_rib)}`].filter(Boolean).join(" · ") : ""}</div></div><div class="document"><h1>${esc(title)}</h1><div class="number">${esc(warranty.warranty_number)}</div><div class="dates">Créé le ${date(warranty.created_at)}<br>Vendeur : ${esc(warranty.created_by_name || "-")}</div></div></header>
    <div class="grid">${config.show_customer === false ? "" : `<section class="box"><h2>CLIENT</h2>${row("Nom complet", warranty.customer_full_name)}${row("Téléphone", warranty.customer_phone)}${row("Email", warranty.customer_email)}${row("Adresse", warranty.customer_address)}</section>`}<section class="box"><h2>${sourceType === "INVOICE" ? "FACTURE" : "VENTE"}</h2>${row(sourceType === "INVOICE" ? "Référence facture" : "Référence vente", sourceReference)}${row("Date de vente", date(warranty.sale_date))}${row("Prix facturé", money(warranty.invoiced_price))}</section></div>
    <section class="product"><div class="product-title">PRODUIT COUVERT</div><div class="product-body"><div class="product-name">${esc(product || warranty.product_nature)}</div>${row("Nature", warranty.product_nature)}${row("Marque", warranty.product_brand)}${row("Modèle", warranty.product_model)}${row("N° de série", warranty.serial_number)}${row("Lot", warranty.batch_number)}<div class="price"><strong>${money(warranty.invoiced_price)}</strong></div></div></section>
    <section class="warranty"><div><span>DURÉE</span><strong>${esc(duration)}</strong></div><div><span>DÉBUT</span><strong>${date(warranty.sale_date)}</strong></div><div><span>FIN DE GARANTIE</span><strong>${date(warranty.warranty_end_date)}</strong></div></section>
    ${warranty.note ? `<section class="note"><strong>NOTE</strong><br><br>${esc(warranty.note)}</section>` : ""}
    ${config.show_signature_area !== false ? `<div class="signatures"><div class="signature">Signature du client</div><div class="signature">Cachet et signature</div></div>` : ""}
    ${config.footer_message ? `<footer class="footer">${esc(config.footer_message)}</footer>` : ""}
  </section></body></html>`;
}
