// Phase 1 原版 Button - 不要修改
export default function Button({ children, onClick, variant = "primary", size = "lg", className = "", ...props }) {
  const base = "font-bold rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2";
  const sizes = { lg: "px-6 py-5 text-lg", md: "px-5 py-3 text-base", sm: "px-4 py-2 text-sm" };
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200",
    success: "bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-200",
    secondary: "bg-white text-slate-700 border-2 border-slate-200 hover:border-slate-300",
    ghost: "text-slate-600 hover:bg-slate-100",
  };
  return (
    <button onClick={onClick} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
