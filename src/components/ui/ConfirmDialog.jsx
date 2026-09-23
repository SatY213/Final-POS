import Modal from "./Modal";
import Button from "./Button";

export default function ConfirmDialog({ open, title, message, confirmLabel, cancelLabel, danger = false, busy = false, confirmationValue, expectedValue, onConfirmationChange, onConfirm, onClose }) {
  const valid = expectedValue == null || confirmationValue === expectedValue;
  return <Modal open={open} title={title} onClose={onClose} width="sm" footer={<><Button onClick={onClose} disabled={busy}>{cancelLabel}</Button><Button variant={danger ? "danger" : "primary"} onClick={onConfirm} disabled={busy || !valid}>{busy ? "…" : confirmLabel}</Button></>}><div className="space-y-4 p-5 text-[12px] leading-5"><p>{message}</p>{expectedValue != null && <label className="block"><span className="mb-1 block text-[11px] font-semibold">{expectedValue}</span><input autoFocus value={confirmationValue} onChange={(event) => onConfirmationChange?.(event.target.value)} className="h-10 w-full border border-gray-400 px-3"/></label>}</div></Modal>;
}
