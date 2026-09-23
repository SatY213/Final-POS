const db = require("../config/database");
require("./migrations/init");

const count = (table) =>
  Number(db.prepare(`SELECT COUNT(*) count FROM ${table}`).get().count);

const result = db.transaction(() => {
  const before = { sales: count("sales"), invoices: count("invoices") };

  // Restore the physical stock impact before removing its sale documents.
  db.prepare(
    `
    UPDATE product_stock
    SET quantity=quantity-COALESCE((
      SELECT SUM(sm.quantity) FROM stock_movements sm
      WHERE sm.product_id=product_stock.product_id
        AND sm.warehouse_id=product_stock.warehouse_id
        AND sm.reference_type IN ('SALE','DELIVERY_NOTE','SALES_RETURN')
    ),0)
  `,
  ).run();
  db.prepare(
    `
    UPDATE stock_batches
    SET quantity=quantity-COALESCE((
      SELECT SUM(sm.quantity) FROM stock_movements sm
      WHERE sm.batch_id=stock_batches.id
        AND sm.reference_type IN ('SALE','DELIVERY_NOTE','SALES_RETURN')
    ),0)
  `,
  ).run();
  db.exec(`
    UPDATE stock_serials SET status='AVAILABLE',sold_at=NULL,updated_at=CURRENT_TIMESTAMP
    WHERE id IN (SELECT serial_id FROM sale_serial_allocations);
    UPDATE quotes SET converted_sale_id=NULL,status=CASE WHEN status='CONVERTED' THEN 'ACCEPTED' ELSE status END;
    DELETE FROM customer_account_entries WHERE sale_id IS NOT NULL OR payment_id IN (SELECT id FROM sale_payments);
    DELETE FROM cash_movements WHERE reference_type IN ('SALE','INVOICE');
    DELETE FROM invoice_payment_allocations;
    DELETE FROM invoice_payments;
    DELETE FROM invoice_lines;
    DELETE FROM invoice_sales;
    DELETE FROM invoices;
    DELETE FROM sales_return_serial_allocations;
    DELETE FROM sales_return_batch_allocations;
    DELETE FROM sales_return_lines;
    DELETE FROM sales_returns;
    DELETE FROM delivery_lines;
    DELETE FROM deliveries;
    DELETE FROM sale_serial_allocations;
    DELETE FROM sale_batch_allocations;
    DELETE FROM sale_payments;
    DELETE FROM stock_movements WHERE reference_type IN ('SALE','DELIVERY_NOTE','SALES_RETURN');
    DELETE FROM sale_lines;
    DELETE FROM sales;
    UPDATE document_sequences SET current_value=0,updated_at=CURRENT_TIMESTAMP WHERE document_type IN ('SALE','INVOICE','SALES_RETURN','DELIVERY_NOTE');
    DELETE FROM warehouse_document_sequences WHERE document_type IN ('SALE','INVOICE','SALES_RETURN','DELIVERY_NOTE');
  `);
  return before;
})();

console.log(
  `Sales reset complete: ${result.sales} sale(s), ${result.invoices} invoice(s) removed.`,
);
