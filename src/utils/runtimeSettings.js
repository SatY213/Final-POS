const defaults = {
  application_name: "MODERNA POS",
  default_currency: "DZD",
  currency_display: "SYMBOL_AFTER",
  monetary_decimals: 2,
  date_format: "DD/MM/YYYY",
  time_format: "24H",
  product_images_enabled: false,
  default_warehouse_id: null,
  default_cash_register_id: null,
  default_page_size: 25,
  confirm_destructive_actions: true,
};

let values = { ...defaults };
export function setRuntimeSettings(next = {}) { values = { ...defaults, ...next }; return values; }
export function getRuntimeSettings() { return values; }
