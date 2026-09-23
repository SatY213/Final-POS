export default function FormField({
  label,
  required,
  error,
  helper,
  children,
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-2.5 block text-[12px] font-semibold leading-4">
        {label}
        {required && <span className="ms-1 text-red-600">*</span>}
      </span>
      {children}
      {error && (
        <span className="mt-1 block text-[11px] text-red-700">{error}</span>
      )}
      {helper && !error && (
        <span className="mt-1 block text-[11px] text-black/50">{helper}</span>
      )}
    </label>
  );
}
export const inputClass =
  "h-[42px] w-full border border-gray-400 bg-white px-3 text-[13px] outline-none";
