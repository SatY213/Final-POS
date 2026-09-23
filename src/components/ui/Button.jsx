export default function Button({
  variant = "secondary",
  icon: Icon,
  className = "",
  children,
  ...props
}) {
  const variants = {
    primary: "border-[#087c1e] bg-[#099323] text-white",
    secondary: "border-gray-400 bg-white text-black",
    danger: "border-red-300 bg-red-50 text-red-700",
    plain: "border-transparent bg-transparent text-black",
  };
  return (
    <button
      type="button"
      {...props}
      className={`flex h-10 items-center justify-center gap-2 border px-4 text-[12px] font-semibold disabled:opacity-50 ${variants[variant]} ${className}`}
    >
      {Icon && <Icon size={16} />} {children}
    </button>
  );
}
