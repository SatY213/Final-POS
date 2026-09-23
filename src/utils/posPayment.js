export const posMoney = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export function calculateCheckoutPayment({
  total,
  balanceUsed = 0,
  method,
  amount = 0,
  amountReceived = 0,
}) {
  const payableTotal = Math.max(0, posMoney(total - balanceUsed));
  const received = Math.max(0, Number(amountReceived || 0));
  const paid = method?.allows_change
    ? Math.min(received, payableTotal)
    : Math.min(Math.max(0, Number(amount || 0)), payableTotal);
  const normalizedPaid = posMoney(paid);
  return {
    payableTotal,
    paid: normalizedPaid,
    received: method?.allows_change ? posMoney(received) : normalizedPaid,
    change: method?.allows_change
      ? Math.max(0, posMoney(received - payableTotal))
      : 0,
    remaining: Math.max(0, posMoney(payableTotal - normalizedPaid)),
  };
}
