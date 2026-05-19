// Phase 1 原版 OptionCard - 不要修改
export default function OptionCard({ option, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`p-4 sm:p-5 rounded-2xl border-4 transition-all active:scale-95 ${
        selected
          ? "border-indigo-500 bg-indigo-50 shadow-lg shadow-indigo-100"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <div className="text-3xl sm:text-4xl mb-2">{option.emoji}</div>
      <div className="font-bold text-sm sm:text-base text-slate-800">{option.label}</div>
    </button>
  );
}
