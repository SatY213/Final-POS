const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );

const money = (v) =>
  `${Number(v || 0).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} DA`;

const infoRow = (label, value) =>
  value
    ? `<div class="info-row">
        <span class="info-label">${esc(label)}</span>
        <span>${esc(value)}</span>
      </div>`
    : "";

const fiscal = (prefix, d) =>
  [
    ["NIF", d[`${prefix}_nif`]],
    ["NIS", d[`${prefix}_nis`]],
    ["Article", d[`${prefix}_tax_article`]],
    ["RC", d[`${prefix}_commercial_register`]],
    ["Activité", d[`${prefix}_business_activity`]],
  ]
    .map(([label, value]) => infoRow(label, value))
    .join("");

export function buildCommercialPrintHtml(document, profile = {}) {
  const c = profile.configuration || {};

  const invoice = !!document?.invoice_number;
  const showDiscounts = c.show_discounts === undefined ? !invoice : c.show_discounts === true;
  const lineTotalBeforeGlobalDiscount = (document?.lines || []).reduce(
    (sum, line) => sum + Number(line.total || 0),
    0,
  );
  const globalDiscountFactor = invoice && lineTotalBeforeGlobalDiscount > 0
    ? Number(document.subtotal || 0) / lineTotalBeforeGlobalDiscount
    : 1;
  let allocatedBefore = 0;
  let allocatedAfter = 0;
  const printedLineTotals = (document?.lines || []).map((line) => {
    if (showDiscounts || !invoice) return Number(line.total || 0);
    allocatedBefore += Number(line.total || 0);
    const cumulativeNet = Math.round(allocatedBefore * globalDiscountFactor * 100) / 100;
    const amount = Math.round((cumulativeNet - allocatedAfter) * 100) / 100;
    allocatedAfter = cumulativeNet;
    return amount;
  });

  const title =
    c.title ||
    (invoice
      ? "FACTURE"
      : document?.delivery_number
        ? "BON DE LIVRAISON"
        : "BON POUR");

  const number =
    document?.invoice_number ||
    document?.delivery_number ||
    document?.quote_number ||
    document?.document_number ||
    document?.sale_number ||
    "-";

  const date =
    document?.invoice_date ||
    document?.delivery_date ||
    document?.sale_date ||
    document?.created_at ||
    "";

  /* ---------------- ARTICLES ---------------- */

  const lines = (document?.lines || [])
    .map(
      (l, i) => `
        <tr>
          <td class="center">${i + 1}</td>

          <td>
            <strong>${esc(l.designation)}</strong>
            ${
              c.show_product_reference && l.reference
                ? `<div class="product-ref">${esc(l.reference)}</div>`
                : ""
            }
          </td>

          <td class="center">${esc(l.unit_name || "-")}</td>

          <td class="number-cell">
            ${esc(l.quantity)}
          </td>

          <td class="number-cell">
            ${money(showDiscounts ? l.unit_price : printedLineTotals[i] / Number(l.quantity || 1))}
          </td>

          ${showDiscounts ? `<td class="number-cell">
            ${
              Number(l.discount_value || 0)
                ? `${Number(l.discount_value)}${
                    l.discount_type === "PERCENT" ? "%" : " DA"
                  }`
                : "-"
            }
          </td>` : ""}

          <td class="number-cell total-cell">
            ${money(printedLineTotals[i])}
          </td>
        </tr>
      `,
    );

  /* ---------------- COMPANY ---------------- */

  const company = `
    ${c.show_logo && profile.logo_data ? `<img class="company-logo" src="${esc(profile.logo_data)}" alt="Logo">` : ""}
    ${
      c.show_warehouse_name !== false
        ? `<div class="company-name">${esc(document?.warehouse_name || "")}</div>`
        : ""
    }

    <div class="company-details">
      ${c.show_legal_info !== false ? fiscal("warehouse", document) : ""}

      ${
        c.show_address !== false
          ? infoRow("Adresse", document?.warehouse_address)
          : ""
      }

      ${
        c.show_phone !== false
          ? infoRow("Téléphone", document?.warehouse_phone)
          : ""
      }

      ${
        c.show_email !== false
          ? infoRow("Email", document?.warehouse_email)
          : ""
      }
    </div>
  `;

  /* ---------------- CUSTOMER ---------------- */

  const customer =
    c.show_customer === false
      ? ""
      : `
        <section class="party client">

          <div class="section-title">
            ${esc(c.party_label ? `INFORMATIONS ${String(c.party_label).toUpperCase()}` : "INFORMATIONS CLIENT")}
          </div>

          <div class="client-name">
            ${esc(document?.customer_name || (c.party_label ? "-" : "Client comptoir"))}
          </div>

          <div class="company-details">
            ${fiscal("customer", document)}

            ${infoRow("Adresse", document?.customer_address)}
            ${infoRow("Téléphone", document?.customer_phone)}
            ${infoRow("Email", document?.customer_email)}
          </div>

        </section>
      `;

  /* ---------------- TOTALS ---------------- */

  const totals = invoice
    ? `
      <div class="totals">

        <div>
          <span>Total HT</span>
          <strong>${money(showDiscounts ? lineTotalBeforeGlobalDiscount : document.subtotal)}</strong>
        </div>

        ${
          showDiscounts && Number(document.discount_amount || 0)
            ? `
            <div>
              <span>Remise globale</span>
              <strong>-${money(document.discount_amount)}</strong>
            </div>
          `
            : ""
        }
        ${showDiscounts && Number(document.discount_amount || 0) ? `<div><span>Net HT</span><strong>${money(document.subtotal)}</strong></div>` : ""}

        <div>
          <span>
            TVA ${
              document.tax_enabled ? `${Number(document.tax_rate || 0)} %` : ""
            }
          </span>

          <strong>
            ${
              document.tax_enabled
                ? money(document.tax_amount)
                : "TVA non comprise"
            }
          </strong>
        </div>

        <div>
          <span>Timbre fiscal</span>

          <strong>
            ${
              document.stamp_enabled
                ? money(document.stamp_amount)
                : "Timbre fiscal non compris"
            }
          </strong>
        </div>

        <div class="grand-total">
          <span>TOTAL TTC</span>
          <strong>${money(document.total)}</strong>
        </div>

      </div>
    `
    : `
      <div class="totals">

        <div class="grand-total">
          <span>TOTAL</span>
          <strong>${money(document.total)}</strong>
        </div>

      </div>
    `;

  /* ---------------- AMOUNT IN WORDS ---------------- */

  const amountWords =
    document?.total_in_words || document?.amount_in_words || "";

  const amountText =
    invoice
      ? `
        <section class="amount-words">
          <div class="amount-title">
            ARRÊTÉE LA PRÉSENTE FACTURE À LA SOMME DE :
          </div>

          <div class="amount-value">
            ${esc(amountWords || money(document.total))}
          </div>
        </section>
      `
      : "";

  const table = (rows) => `
    <table>
      <thead><tr>
        <th style="width:5%">#</th><th>Désignation</th><th style="width:10%">Unité</th>
        <th style="width:9%;text-align:right">Qté</th>
        <th style="width:${showDiscounts ? "15" : "25"}%;text-align:right">Prix unitaire ${showDiscounts ? "HT" : "net HT"}</th>
        ${showDiscounts ? '<th style="width:10%;text-align:right">Remise</th>' : ""}
        <th style="width:${showDiscounts ? "16" : "17"}%;text-align:right">Total HT</th>
      </tr></thead>
      <tbody>${rows.join("")}</tbody>
    </table>`;
  const header = `<header class="header"><div>${company}</div><div class="document"><div class="document-title">${esc(title)}</div><div class="document-number">N° ${esc(number)}</div><div class="document-meta"><div><strong>Date :</strong> ${esc(date)}</div><div><strong>Devise :</strong> DZD</div></div></div></header>`;
  const continuedHeader = `<div class="continued-header"><strong>${esc(title)} · N° ${esc(number)}</strong><span>Suite des articles</span></div>`;
  const chunks = [];
  if (lines.length <= 9) chunks.push(lines);
  else {
    chunks.push(lines.slice(0, 9));
    let remaining = lines.slice(9);
    while (remaining.length > 10) {
      chunks.push(remaining.slice(0, 18));
      remaining = remaining.slice(18);
    }
    chunks.push(remaining);
  }
  const pages = chunks.map((rows, index) => `<section class="print-page">${index === 0 ? `${header}${customer}` : continuedHeader}${table(rows)}${index === chunks.length - 1 ? `<div class="totals-wrapper">${totals}</div>${amountText}<footer class="footer"><div class="issuer-footer">Document émis par<br><strong>${esc(document?.warehouse_name || "")}</strong></div><div class="signature"><div class="signature-title">Signature et cachet</div></div></footer>` : ""}</section>`).join("");

  /* ---------------- HTML ---------------- */

  return `
<!doctype html>

<html lang="fr">

<head>

<meta charset="utf-8">

<title>${esc(title)} ${esc(number)}</title>

<style>

@page {
  size: ${profile.paper_format || "A4"};
  margin: 12mm;
}

* {
  box-sizing: border-box;
}

html {
  width: 100%;
  min-height: 100%;
  overflow: hidden;
  background: #e5e7eb;
}

body {
  margin: 0;
  overflow: visible;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 10.5px;
  line-height: 1.45;
  color: #111;
  background: transparent;
}

.print-page {
  min-height: 297mm;
  padding: 15mm 16mm;
  background: #fff;
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.16);
}

.print-page + .print-page {
  margin-top: 24px;
}

.continued-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 10px;
  border-bottom: 2px solid #111;
  font-size: 11px;
}

.continued-header span {
  color: #555;
  font-size: 9px;
}

/* =========================
   HEADER
========================= */

.header {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 35px;

  padding-bottom: 20px;
  border-bottom: 2px solid #111;
}

.company-logo {
  display: block;
  max-width: 40mm;
  max-height: 22mm;
  object-fit: contain;
  margin-bottom: 8px;
}

.company-name {
  font-size: 23px;
  font-weight: 700;
  margin-bottom: 10px;
}

.company-details {
  line-height: 1.55;
}

.info-row {
  display: flex;
  gap: 6px;
}

.info-label {
  font-weight: 700;
}

/* DOCUMENT */

.document {
  text-align: right;
}

.document-title {
  font-size: 32px;
  font-weight: 800;
  letter-spacing: 1.5px;
  margin-bottom: 12px;
}

.document-number {
  display: inline-block;

  border: 1px solid #111;

  padding: 7px 14px;

  font-size: 14px;
  font-weight: 700;
}

.document-meta {
  margin-top: 10px;
  line-height: 1.7;
  color: #333;
}

/* =========================
   CUSTOMER
========================= */

.party {
  margin-top: 20px;

  border: 1px solid #aaa;

  padding: 14px 16px;
}

.section-title {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 1px;

  margin-bottom: 7px;

  color: #555;
}

.client-name {
  font-size: 15px;
  font-weight: 700;

  margin-bottom: 5px;
}

/* =========================
   TABLE
========================= */

table {
  width: 100%;
  border-collapse: collapse;

  margin-top: 24px;
}

thead {
  display: table-header-group;
}

th {
  background: #f2f2f2;

  border-top: 1px solid #111;
  border-bottom: 1px solid #111;

  padding: 9px 7px;

  font-size: 9px;
  text-transform: uppercase;

  text-align: left;
}

td {
  padding: 10px 7px;

  border-bottom: 1px solid #ccc;

  vertical-align: middle;
}

.center {
  text-align: center;
}

.number-cell {
  text-align: right;
  white-space: nowrap;
}

.total-cell {
  font-weight: 700;
}

.product-ref {
  margin-top: 2px;

  font-size: 9px;
  color: #666;
}

/* =========================
   TOTALS
========================= */

.totals-wrapper {
  display: flex;
  justify-content: flex-end;

  margin-top: 25px;
}

.totals {
  width: 330px;

  border-top: 1px solid #111;
}

.totals > div {
  display: flex;
  justify-content: space-between;

  gap: 20px;

  padding: 7px 4px;

  border-bottom: 1px solid #ddd;
}

.grand-total {
  margin-top: 3px;

  border-top: 2px solid #111 !important;
  border-bottom: 2px solid #111 !important;

  padding: 11px 4px !important;

  font-size: 16px;
  font-weight: 800;
}

/* =========================
   AMOUNT IN WORDS
========================= */

.amount-words {
  margin-top: 30px;

  padding-top: 13px;

  border-top: 1px solid #aaa;
}

.amount-title {
  font-size: 9px;
  font-weight: 700;

  margin-bottom: 5px;
}

.amount-value {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}

/* =========================
   FOOTER
========================= */

.footer {
  margin-top: 45px;

  display: grid;
  grid-template-columns: 1fr 1fr;

  gap: 50px;
}

.signature {
  text-align: right;
}

.signature-title {
  font-weight: 700;
  margin-bottom: 45px;
}

.issuer-footer {
  color: #555;
}

/* PRINT */

tr {
  page-break-inside: avoid;
  break-inside: avoid;
}

.totals-wrapper,
.amount-words,
.footer {
  page-break-inside: avoid;
  break-inside: avoid;
}

@media print {
  html,
  body {
    min-height: 0;
    padding: 0;
    overflow: visible;
  }

  .print-page {
    min-height: 0;
    padding: 0;
    box-shadow: none;
    break-after: page;
    page-break-after: always;
  }

  .print-page:last-child {
    break-after: auto;
    page-break-after: auto;
  }

  html {
    background: #fff;
  }
}

</style>

</head>

<body>
${pages}

</body>

</html>
`;
}
