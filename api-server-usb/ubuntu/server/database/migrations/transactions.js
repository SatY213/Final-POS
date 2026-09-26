const db = require("../../config/database");

// Financial events are intentionally independent from commercial documents.
// Financial events belong to one shared transaction layer. Purchase payments
// are linked directly to their receipt, without a second payment table.
db.exec(`
  CREATE TABLE IF NOT EXISTS financial_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    direction TEXT NOT NULL CHECK(direction IN ('IN','OUT')),
    party_type TEXT NOT NULL CHECK(party_type IN ('CUSTOMER','SUPPLIER')),
    customer_id INTEGER,
    supplier_id INTEGER,
    payment_method_code TEXT NOT NULL,
    amount REAL NOT NULL CHECK(amount>0),
    reference TEXT,
    source_type TEXT NOT NULL,
    sale_payment_id INTEGER UNIQUE,
    invoice_payment_id INTEGER UNIQUE,
    cash_session_id INTEGER,
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
    FOREIGN KEY(supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
    FOREIGN KEY(payment_method_code) REFERENCES payment_methods(code) ON DELETE RESTRICT,
    FOREIGN KEY(sale_payment_id) REFERENCES sale_payments(id) ON DELETE RESTRICT,
    FOREIGN KEY(invoice_payment_id) REFERENCES invoice_payments(id) ON DELETE RESTRICT,
    FOREIGN KEY(cash_session_id) REFERENCES cash_sessions(id) ON DELETE RESTRICT,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE RESTRICT
  );
  CREATE INDEX IF NOT EXISTS financial_transactions_date ON financial_transactions(created_at DESC,id DESC);
  CREATE INDEX IF NOT EXISTS financial_transactions_customer ON financial_transactions(customer_id,created_at DESC);
  CREATE TRIGGER IF NOT EXISTS transaction_from_sale_payment
  AFTER INSERT ON sale_payments WHEN NEW.invoice_payment_id IS NULL
  BEGIN
    INSERT OR IGNORE INTO financial_transactions(direction,party_type,customer_id,payment_method_code,amount,reference,source_type,sale_payment_id,cash_session_id,created_by,created_at)
    SELECT 'IN','CUSTOMER',s.customer_id,NEW.payment_method_code,NEW.amount,NEW.reference,'SALE_PAYMENT',NEW.id,NEW.cash_session_id,NEW.created_by,NEW.created_at FROM sales s WHERE s.id=NEW.sale_id;
  END;
  CREATE TRIGGER IF NOT EXISTS transaction_from_invoice_payment
  AFTER INSERT ON invoice_payments
  BEGIN
    INSERT OR IGNORE INTO financial_transactions(direction,party_type,customer_id,payment_method_code,amount,reference,source_type,invoice_payment_id,cash_session_id,created_by,created_at)
    SELECT 'IN','CUSTOMER',i.customer_id,NEW.payment_method_code,NEW.amount,NEW.reference,'INVOICE_PAYMENT',NEW.id,NEW.cash_session_id,NEW.created_by,NEW.created_at FROM invoices i WHERE i.id=NEW.invoice_id;
  END;
  INSERT OR IGNORE INTO financial_transactions(direction,party_type,customer_id,payment_method_code,amount,reference,source_type,sale_payment_id,cash_session_id,created_by,created_at)
  SELECT 'IN','CUSTOMER',s.customer_id,p.payment_method_code,p.amount,p.reference,'SALE_PAYMENT',p.id,p.cash_session_id,p.created_by,p.created_at FROM sale_payments p JOIN sales s ON s.id=p.sale_id WHERE p.invoice_payment_id IS NULL;
  INSERT OR IGNORE INTO financial_transactions(direction,party_type,customer_id,payment_method_code,amount,reference,source_type,invoice_payment_id,cash_session_id,created_by,created_at)
  SELECT 'IN','CUSTOMER',i.customer_id,p.payment_method_code,p.amount,p.reference,'INVOICE_PAYMENT',p.id,p.cash_session_id,p.created_by,p.created_at FROM invoice_payments p JOIN invoices i ON i.id=p.invoice_id;
`);
const transactionColumns = new Set(
  db.prepare("PRAGMA table_info(financial_transactions)").all().map((column) => column.name),
);
if (!transactionColumns.has("purchase_receipt_id"))
  db.exec("ALTER TABLE financial_transactions ADD COLUMN purchase_receipt_id INTEGER");
if (!transactionColumns.has("supplier_return_id"))
  db.exec("ALTER TABLE financial_transactions ADD COLUMN supplier_return_id INTEGER");
if (!transactionColumns.has("sales_return_id"))
  db.exec("ALTER TABLE financial_transactions ADD COLUMN sales_return_id INTEGER");
if (!transactionColumns.has("client_request_id"))
  db.exec("ALTER TABLE financial_transactions ADD COLUMN client_request_id TEXT");
db.exec(`
  DROP INDEX IF EXISTS financial_transactions_purchase_receipt;
  CREATE INDEX IF NOT EXISTS financial_transactions_purchase_receipt
    ON financial_transactions(purchase_receipt_id) WHERE purchase_receipt_id IS NOT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS financial_transactions_client_request
    ON financial_transactions(client_request_id) WHERE client_request_id IS NOT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS financial_transactions_supplier_return
    ON financial_transactions(supplier_return_id) WHERE supplier_return_id IS NOT NULL;
  CREATE INDEX IF NOT EXISTS financial_transactions_sales_return
    ON financial_transactions(sales_return_id) WHERE sales_return_id IS NOT NULL;
  UPDATE financial_transactions
  SET sales_return_id=CAST(substr(reference,instr(reference,':')+1) AS INTEGER)
  WHERE source_type='CUSTOMER_RETURN_REFUND'
    AND sales_return_id IS NULL
    AND reference LIKE 'RETURN:%';
`);
module.exports = true;
