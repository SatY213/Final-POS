import { useEffect, useState } from "react";
import { ReceiptText, Search } from "lucide-react";
import { getTransactions } from "../../api/transaction.model";
import ErrorMessage from "../../components/ui/ErrorMessage";
import { formatDateTime, formatMoney } from "../../utils/formatters";
import { useLanguage } from "../../i18n/LanguageContext";
import ExportButton from "../../components/data-exchange/ExportButton";

export default function Transactions({ onNavigate, warehouseId, initialFilters = null }) {
  const { t, language } = useLanguage();
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const today = new Date().toISOString().slice(0, 10);
  const queryFilters = {
    direction: initialFilters?.direction || "",
    from: initialFilters?.period === "today" ? today : initialFilters?.from || "",
    to: initialFilters?.period === "today" ? today : initialFilters?.to || "",
  };

  useEffect(() => {
    setSearch(initialFilters?.search || "");
  }, [initialFilters]);

  useEffect(() => {
    setError("");
    getTransactions({ search, warehouse_id: warehouseId || "", ...queryFilters })
      .then(setItems)
      .catch((requestError) => setError(requestError.message));
  }, [search, warehouseId, queryFilters.direction, queryFilters.from, queryFilters.to]);

  function openDocument(transaction) {
    if (
      transaction.purchase_receipt_id ||
      transaction.supplier_return_id
    ) {
      onNavigate("purchases");
      return;
    }
    if (transaction.invoice_id) {
      onNavigate("sales", { invoiceId: transaction.invoice_id });
      return;
    }
    if (transaction.sale_id)
      onNavigate("sales", { saleId: transaction.sale_id });
  }

  return (
    <div className="h-full overflow-auto bg-[#f5f7f5] p-6">
      <section className="w-full border border-gray-300 bg-white">
        <header className="flex items-center gap-3 border-b p-5">
          <ReceiptText className="text-[#099323]" />
          <div>
            <h1 className="font-bold">{t("transactions")}</h1>
            <p className="text-[12px] text-black/55">
              {t("transactionsDescription")}
            </p>
          </div>
          <ExportButton
            entity="transactions"
            query={{ warehouse_id: warehouseId, search, ...queryFilters }}
            onError={setError}
            className="ml-auto"
          />
        </header>
        <ErrorMessage message={error} onClose={() => setError("")} />
        <label className="relative block border-b p-4">
          <Search
            size={16}
            className="absolute left-7 top-7 text-black/45"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("searchTransactions")}
            className="h-10 w-full border border-gray-400 pl-9 pr-3 text-[12px]"
          />
        </label>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="h-11 border-b bg-gray-50">
                <th className="px-5">{t("date")}</th>
                <th>{t("partner")}</th>
                <th>{t("documentType")}</th>
                <th>{t("documentNumber")}</th>
                <th>{t("paymentMethod")}</th>
                <th className="px-5 text-right">{t("amount")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((transaction) => {
                const document = transactionDocument(transaction, t);
                return (
                  <tr key={transaction.id} className="h-12 border-b">
                    <td className="px-5">
                      {formatDateTime(transaction.created_at, language)}
                    </td>
                    <td>
                      {transaction.customer_name ||
                        transaction.supplier_name ||
                        "-"}
                    </td>
                    <td>{document.type}</td>
                    <td>
                      {document.number ? (
                        <button
                          type="button"
                          className="font-medium text-blue-700 hover:underline"
                          onClick={() => openDocument(transaction)}
                        >
                          {document.number}
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{transaction.payment_method_name || "—"}</td>
                    <td
                      className={`px-5 text-right font-semibold ${transaction.direction === "OUT" ? "text-red-700" : "text-green-700"}`}
                    >
                      {transaction.direction === "OUT" ? "-" : "+"}
                      {formatMoney(transaction.amount)}
                    </td>
                  </tr>
                );
              })}
              {!items.length && (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-black/45">
                    {t("noTransactions")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function transactionDocument(transaction, t) {
  const delivery = transaction.sale_fulfillment_mode === "SHIPPING";
  const saleNumber = transaction.sale_number;
  const types = {
    SALE_PAYMENT: delivery ? t("delivery") : t("sale"),
    INVOICE_PAYMENT: t("invoice"),
    CUSTOMER_RETURN_REFUND: delivery ? t("deliveryReturn") : t("saleReturn"),
    PURCHASE_RECEIPT: t("purchaseReceipt"),
    PURCHASE_PAYMENT: t("supplierPayment"),
    SUPPLIER_RETURN: t("supplierReturn"),
    SUPPLIER_RETURN_CREDIT: t("supplierReturnCredit"),
    SUPPLIER_RETURN_REFUND: t("supplierReturnRefund"),
  };
  let number = transaction.reference || null;
  if (
    ["SALE_PAYMENT", "CUSTOMER_RETURN_REFUND"].includes(
      transaction.source_type,
    )
  )
    number = saleNumber;
  else if (transaction.source_type === "INVOICE_PAYMENT")
    number = transaction.invoice_number;
  else if (transaction.source_type === "PURCHASE_RECEIPT")
    number = transaction.receipt_number;
  else if (transaction.source_type === "PURCHASE_PAYMENT")
    number = transaction.receipt_number;
  else if (
    [
      "SUPPLIER_RETURN",
      "SUPPLIER_RETURN_CREDIT",
      "SUPPLIER_RETURN_REFUND",
    ].includes(
      transaction.source_type,
    )
  )
    number = transaction.receipt_number;
  return {
    type:
      types[transaction.source_type] ||
      String(transaction.source_type || "Transaction").replaceAll("_", " "),
    number,
  };
}
