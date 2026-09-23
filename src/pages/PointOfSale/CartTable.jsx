import { Trash2 } from "lucide-react";
import { formatMoney, formatQuantity } from "../../utils/formatters";
export default function CartTable({
  lines,
  selected,
  onSelect,
  onRemove,
  onEditPrice,
  warningDays = 30,
  language,
  t,
}) {
  return (
    <div className="min-h-0 flex-1 overflow-auto border-x border-b border-gray-300 bg-white">
      <table className="w-full border-collapse text-[12px]">
        <thead className="sticky top-0 z-10 bg-gray-100">
          <tr className="h-10 border-b border-gray-300 text-left">
            <th className="px-3">{t("designation")}</th>
            <th>{t("quantity")}</th>
            <th>{t("unit")}</th>
            <th className="text-right">{t("unitPrice")}</th>
            <th className="text-right">{t("discount")}</th>
            <th className="text-right">{t("total")}</th>
            <th className="w-12" />
          </tr>
        </thead>
        <tbody>
          {!lines.length ? (
            <tr>
              <td
                colSpan="7"
                className="h-[220px] text-center text-[13px] text-black/45"
              >
                {t("posEmptyCart")}
              </td>
            </tr>
          ) : (
            lines.map((line, index) => (
              <tr
                key={line.key}
                data-pos-cart-row
                tabIndex={0}
                aria-selected={selected === index}
                onClick={() => onSelect(index)}
                onFocus={() => onSelect(index)}
                onDoubleClick={() => onEditPrice(index)}
                className={`h-12 cursor-default border-b border-gray-200 outline-none ${selected === index ? "bg-green-50 outline outline-1 outline-inset outline-green-300" : ""}`}
              >
                <td className="px-3">
                  <b>{line.designation}</b>
                  {line.reference && (
                    <small className="ms-2 text-black/45">
                      {line.reference}
                    </small>
                  )}
                  {line.track_stock &&
                    Number(line.stock_quantity) <
                      Number(line.quantity) *
                        Number(line.conversion_factor) && (
                      <small className="ms-2 font-semibold text-red-700">
                        {t("insufficientStock")}
                      </small>
                    )}
                  {line.track_stock &&
                    Number(line.stock_quantity) > 0 &&
                    Number(line.stock_quantity) <= Number(line.min_stock) && (
                      <small className="ms-2 font-semibold text-amber-700">
                        {t("lowStock")}
                      </small>
                    )}
                  {isNearExpiration(line.nearest_expiration, warningDays) && (
                    <small
                      className={`ms-2 font-semibold ${line.nearest_expiration < new Date().toISOString().slice(0, 10) ? "text-red-700" : "text-amber-700"}`}
                    >
                      {t("expires")}: {line.nearest_expiration}
                    </small>
                  )}
                </td>
                <td>{formatQuantity(line.quantity, language)}</td>
                <td>{line.unit_name}</td>
                <td className="text-right">
                  {formatMoney(line.unit_price, language)}
                </td>
                <td className="text-right">
                  {Number(line.discount_value ?? line.discount_percent ?? 0)
                    ? line.discount_type === "FIXED"
                      ? formatMoney(line.discount_value, language)
                      : `${line.discount_value ?? line.discount_percent}%`
                    : "-"}
                </td>
                <td className="text-right font-bold">
                  {formatMoney(line.preview_total, language)}
                </td>
                <td>
                  <button
                    type="button"
                    title={t("remove")}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(index);
                    }}
                    className="flex h-8 w-8 items-center justify-center text-red-700"
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
function isNearExpiration(value, days) {
  if (!value) return false;
  const limit = new Date();
  limit.setDate(limit.getDate() + Number(days || 30));
  return value <= limit.toISOString().slice(0, 10);
}
