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

const EAN_L = [
  "0001101", "0011001", "0010011", "0111101", "0100011",
  "0110001", "0101111", "0111011", "0110111", "0001011",
];
const EAN_G = [
  "0100111", "0110011", "0011011", "0100001", "0011101",
  "0111001", "0000101", "0010001", "0001001", "0010111",
];
const EAN_R = [
  "1110010", "1100110", "1101100", "1000010", "1011100",
  "1001110", "1010000", "1000100", "1001000", "1110100",
];
const EAN_PARITY = [
  "LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG",
  "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL",
];

export function ean13CheckDigit(value) {
  const digits = String(value ?? "");
  if (!/^\d{12}$/.test(digits)) return null;
  const sum = [...digits].reduce(
    (total, digit, index) => total + Number(digit) * (index % 2 ? 3 : 1),
    0,
  );
  return String((10 - (sum % 10)) % 10);
}

export function normalizeEan13(value) {
  const text = String(value ?? "").trim();
  if (/^\d{12}$/.test(text)) return `${text}${ean13CheckDigit(text)}`;
  if (/^\d{13}$/.test(text) && ean13CheckDigit(text.slice(0, 12)) === text[12])
    return text;
  return null;
}

export function encodeEan13(value) {
  const text = normalizeEan13(value);
  if (!text) return null;
  const parity = EAN_PARITY[Number(text[0])];
  let modules = "101";
  for (let index = 1; index <= 6; index += 1) {
    const digit = Number(text[index]);
    modules += parity[index - 1] === "L" ? EAN_L[digit] : EAN_G[digit];
  }
  modules += "01010";
  for (let index = 7; index <= 12; index += 1)
    modules += EAN_R[Number(text[index])];
  modules += "101";
  return { text, modules };
}

export function encodeCode128B(value) {
  const text = String(value ?? "");
  if (
    !text ||
    [...text].some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code > 126;
    })
  )
    return null;
  const codes = [104, ...[...text].map((character) => character.charCodeAt(0) - 32)];
  const checksum = codes.reduce(
    (sum, code, index) => sum + (index === 0 ? code : code * index),
    0,
  ) % 103;
  codes.push(checksum, 106);
  return { text, codes };
}

const code128Checksum = (codes) =>
  codes.reduce(
    (sum, code, index) => sum + (index === 0 ? code : code * index),
    0,
  ) % 103;

const numericRunLength = (text, start) => {
  let end = start;
  while (end < text.length && /\d/.test(text[end])) end += 1;
  return end - start;
};

// Code Set B handles the alphanumeric portions while Code Set C compacts each
// sufficiently long numeric run. This is a valid Code 128 auto-encoding and
// keeps mixed references such as "PC-2026-000123" readable on narrow labels.
export function encodeCode128(value) {
  const text = String(value ?? "");
  if (
    !text ||
    [...text].some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code > 126;
    })
  )
    return null;

  const codes = [];
  let index = 0;
  let activeSet;
  const initialDigits = numericRunLength(text, 0);
  if (initialDigits >= 4 && initialDigits % 2 === 0) {
    codes.push(105);
    activeSet = "C";
  } else {
    codes.push(104);
    activeSet = "B";
  }

  while (index < text.length) {
    const digits = numericRunLength(text, index);
    if (activeSet === "B") {
      if (digits >= 4) {
        if (digits % 2) {
          codes.push(text.charCodeAt(index) - 32);
          index += 1;
        }
        codes.push(99);
        activeSet = "C";
        continue;
      }
      codes.push(text.charCodeAt(index) - 32);
      index += 1;
      continue;
    }

    if (digits >= 2) {
      codes.push(Number(text.slice(index, index + 2)));
      index += 2;
    } else {
      codes.push(100);
      activeSet = "B";
    }
  }

  codes.push(code128Checksum(codes), 106);
  return { text, codes };
}

export function code128Svg(value, showText = true) {
  const encoded = encodeCode128(value);
  if (!encoded) return "";
  const quietZone = 10;
  let x = quietZone,
    bars = "";
  for (const code of encoded.codes) {
    let bar = true;
    for (const widthChar of patterns[code]) {
      const width = Number(widthChar);
      if (bar) bars += `<rect x="${x}" y="0" width="${width}" height="48"/>`;
      x += width;
      bar = !bar;
    }
  }
  const totalWidth = x + quietZone;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${showText ? 62 : 50}" preserveAspectRatio="none" shape-rendering="crispEdges" data-symbology="CODE128" aria-label="${esc(encoded.text)}"><g fill="#000">${bars}</g>${showText ? `<text x="${totalWidth / 2}" y="60" text-anchor="middle" font-family="Arial" font-size="10">${esc(encoded.text)}</text>` : ""}</svg>`;
}

export function ean13Svg(value, showText = true) {
  const encoded = encodeEan13(value);
  if (!encoded) return "";
  const leftQuiet = 11;
  const rightQuiet = 7;
  const guards = new Set([0, 2, 46, 48, 92, 94]);
  let bars = "";
  for (let index = 0; index < encoded.modules.length; index += 1) {
    if (encoded.modules[index] !== "1") continue;
    bars += `<rect x="${leftQuiet + index}" y="0" width="1" height="${guards.has(index) ? 48 : 42}"/>`;
  }
  const totalWidth = leftQuiet + encoded.modules.length + rightQuiet;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${showText ? 62 : 50}" preserveAspectRatio="none" shape-rendering="crispEdges" data-symbology="EAN13" aria-label="${encoded.text}"><g fill="#000">${bars}</g>${showText ? `<text x="${totalWidth / 2}" y="60" text-anchor="middle" font-family="Arial" font-size="10" letter-spacing="1">${encoded.text}</text>` : ""}</svg>`;
}

export function isBarcodeValueValid(value, symbology = "CODE128") {
  return symbology === "EAN13"
    ? Boolean(normalizeEan13(value))
    : Boolean(encodeCode128(value));
}

export function barcodeSvg(value, symbology = "CODE128", showText = true) {
  return symbology === "EAN13"
    ? ean13Svg(value, showText)
    : code128Svg(value, showText);
}

export function barcodeModuleCount(value, symbology = "CODE128") {
  if (symbology === "EAN13") return encodeEan13(value) ? 113 : 0;
  const encoded = encodeCode128(value);
  if (!encoded) return 0;
  return (encoded.codes.length - 1) * 11 + 13 + 20;
}

export function recommendedBarcodeWidthMm(value, symbology = "CODE128") {
  const modules = barcodeModuleCount(value, symbology);
  // Two dots per narrow module on the common 203-DPI label printers.
  return modules ? Math.ceil(modules * 0.25 * 2) / 2 : 0;
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
    symbology = config.symbology || "CODE128",
    showBarcodeText = config.show_barcode_text !== false,
    barcodeHeight = Math.min(
      Number(config.barcode_height_mm || 13),
      Math.max(1, height - 8),
    ),
    barcodeWidth = Math.min(
      Number(config.barcode_width_mm || width),
      width,
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
        return `<article class="label">${config.show_product_name !== false ? `<div class="name" style="--name-font-size:${adaptiveFont}px">${esc(row.designation)}</div>` : ""}${config.show_price !== false && pricePosition === "TOP" ? `<div class="price">${Number(row.selling_price || 0).toFixed(2)} DA</div>` : ""}<div class="barcode">${barcodeSvg(row.barcode, symbology, showBarcodeText)}</div>${config.show_reference && row.reference ? `<div class="reference">Réf. ${esc(row.reference)}</div>` : ""}${config.show_price !== false && pricePosition === "BOTTOM" ? `<div class="price">${Number(row.selling_price || 0).toFixed(2)} DA</div>` : ""}</article>`;
      })
      .join(""),
    previewCss = profile.preview
      ? "body{min-height:100vh;display:grid;place-items:center;background:#f3f4f6}.label{background:#fff;box-shadow:0 1px 5px rgba(0,0,0,.18);page-break-after:auto;break-after:auto}"
      : "";
  return `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:${width}mm ${height}mm portrait;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;font-family:Arial;color:#000}.label{width:${width}mm;height:${height}mm;overflow:hidden;padding:${padding}mm;gap:${gap}mm;display:flex;flex-direction:column;align-items:center;justify-content:center;page-break-after:always;break-after:page}.label:last-child{page-break-after:auto;break-after:auto}.name{width:100%;max-height:2.3em;font-size:var(--name-font-size,${nameFont}px);font-weight:700;line-height:1.15;text-align:center;white-space:normal;overflow:hidden;overflow-wrap:anywhere;word-break:break-word}.price{font-size:${priceFont}px;font-weight:700}.barcode{width:${barcodeWidth}mm;height:${barcodeHeight}mm;flex:none}.barcode svg{display:block;width:100%;height:100%}.reference{font-size:${referenceFont}px}${previewCss}</style></head><body>${labels}</body></html>`;
}
