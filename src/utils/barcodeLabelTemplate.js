const patterns = [
  "212222",
  "222122",
  "222221",
  "121223",
  "121322",
  "131222",
  "122213",
  "122312",
  "132212",
  "221213",
  "221312",
  "231212",
  "112232",
  "122132",
  "122231",
  "113222",
  "123122",
  "123221",
  "223211",
  "221132",
  "221231",
  "213212",
  "223112",
  "312131",
  "311222",
  "321122",
  "321221",
  "312212",
  "322112",
  "322211",
  "212123",
  "212321",
  "232121",
  "111323",
  "131123",
  "131321",
  "112313",
  "132113",
  "132311",
  "211313",
  "231113",
  "231311",
  "112133",
  "112331",
  "132131",
  "113123",
  "113321",
  "133121",
  "313121",
  "211331",
  "231131",
  "213113",
  "213311",
  "213131",
  "311123",
  "311321",
  "331121",
  "312113",
  "312311",
  "332111",
  "314111",
  "221411",
  "431111",
  "111224",
  "111422",
  "121124",
  "121421",
  "141122",
  "141221",
  "112214",
  "112412",
  "122114",
  "122411",
  "142112",
  "142211",
  "241211",
  "221114",
  "413111",
  "241112",
  "134111",
  "111242",
  "121142",
  "121241",
  "114212",
  "124112",
  "124211",
  "411212",
  "421112",
  "421211",
  "212141",
  "214121",
  "412121",
  "111143",
  "111341",
  "131141",
  "114113",
  "114311",
  "411113",
  "411311",
  "113141",
  "114131",
  "311141",
  "411131",
  "211412",
  "211214",
  "211232",
  "2331112",
];
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function code128Svg(value, showText = true) {
  const text = String(value || "");
  if (
    !text ||
    [...text].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) > 126)
  )
    return "";
  const codes = [104, ...[...text].map((c) => c.charCodeAt(0) - 32)],
    checksum =
      codes.reduce(
        (sum, code, index) => sum + (index ? code * index : code),
        0,
      ) % 103;
  codes.push(checksum, 106);
  let x = 10,
    bars = "";
  for (const code of codes) {
    let bar = true;
    for (const widthChar of patterns[code]) {
      const width = Number(widthChar) * 2;
      if (bar) bars += `<rect x="${x}" y="0" width="${width}" height="48"/>`;
      x += width;
      bar = !bar;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x + 10} ${showText ? 62 : 50}" preserveAspectRatio="none" aria-label="${esc(text)}"><g fill="#000">${bars}</g>${showText ? `<text x="${(x + 10) / 2}" y="60" text-anchor="middle" font-family="Arial" font-size="10">${esc(text)}</text>` : ""}</svg>`;
}
export function adaptiveLabelNameFont(value, configuredSize) {
  const length = String(value || "").trim().length;
  const factor =
    length > 60
      ? 0.58
      : length > 45
        ? 0.68
        : length > 32
          ? 0.78
          : length > 20
            ? 0.9
            : 1;
  return Math.max(
    6,
    Math.round(Number(configuredSize || 10) * factor * 10) / 10,
  );
}
export function getBarcodeLabelDimensions(profile = {}) {
  const format = profile.paper_format || "50x30mm";
  const config = profile.configuration || {};
  const preset =
    format === "CUSTOM" ? [] : format.replace("mm", "").split("x").map(Number);
  return {
    width: Number(preset[0] || config.label_width_mm || 50),
    height: Number(preset[1] || config.label_height_mm || 30),
  };
}
export function buildBarcodeLabelsHtml(rows, profile = {}) {
  const format = profile.paper_format || "50x30mm",
    config = profile.configuration || {},
    dimensions = getBarcodeLabelDimensions(profile),
    width = dimensions.width,
    height = dimensions.height,
    nameFont = Number(config.name_font_size || 10),
    priceFont = Number(config.price_font_size || 13),
    referenceFont = Number(config.reference_font_size || 8),
    gap = Number(config.content_gap_mm ?? 1),
    padding = Number(config.label_padding_mm ?? 2),
    pricePosition = config.price_position || "TOP",
    showBarcodeText = config.show_barcode_text !== false,
    barcodeHeight = Math.min(
      Number(config.barcode_height_mm || 13),
      Math.max(6, height - 8),
    ),
    labels = rows
      .flatMap((row) =>
        Array.from(
          { length: Math.max(0, Number(row.quantity) || 0) },
          () => row,
        ),
      )
      .map((row) => {
        const adaptiveFont = adaptiveLabelNameFont(row.designation, nameFont);
        return `<article class="label">${config.show_product_name !== false ? `<div class="name" style="--name-font-size:${adaptiveFont}px">${esc(row.designation)}</div>` : ""}${config.show_price !== false && pricePosition === "TOP" ? `<div class="price">${Number(row.selling_price || 0).toFixed(2)} DA</div>` : ""}<div class="barcode">${code128Svg(row.barcode, showBarcodeText)}</div>${config.show_reference && row.reference ? `<div class="reference">Réf. ${esc(row.reference)}</div>` : ""}${config.show_price !== false && pricePosition === "BOTTOM" ? `<div class="price">${Number(row.selling_price || 0).toFixed(2)} DA</div>` : ""}</article>`;
      })
      .join(""),
    previewCss = profile.preview
      ? "body{min-height:100vh;display:grid;place-items:center;background:#f3f4f6}.label{background:#fff;box-shadow:0 1px 5px rgba(0,0,0,.18);page-break-after:auto;break-after:auto}"
      : "";
  return `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:${width}mm ${height}mm portrait;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;font-family:Arial;color:#000}.label{width:${width}mm;height:${height}mm;overflow:hidden;padding:${padding}mm;gap:${gap}mm;display:flex;flex-direction:column;align-items:center;justify-content:center;page-break-after:always;break-after:page}.label:last-child{page-break-after:auto;break-after:auto}.name{width:100%;max-height:2.3em;font-size:var(--name-font-size,${nameFont}px);font-weight:700;line-height:1.15;text-align:center;white-space:normal;overflow:hidden;overflow-wrap:anywhere;word-break:break-word}.price{font-size:${priceFont}px;font-weight:700}.barcode{width:100%;height:${barcodeHeight}mm}.barcode svg{width:100%;height:100%}.reference{font-size:${referenceFont}px}${previewCss}</style></head><body>${labels}</body></html>`;
}
