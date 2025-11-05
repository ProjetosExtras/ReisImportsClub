import { Flame } from "lucide-react";

interface StockUrgencyBarProps {
  remaining: number;
  className?: string;
  threshold?: number; // show bar when remaining <= threshold
}

// Pill-shaped urgency bar with flame icon and "SÓ MAIS {n}" text.
// Fills proportionally up to the threshold (default 10).
export const StockUrgencyBar = ({ remaining, className = "", threshold = 10 }: StockUrgencyBarProps) => {
  if (remaining <= 0 || remaining > threshold) return null;

  const pct = Math.max(0, Math.min(100, Math.round((remaining / threshold) * 100)));

  return (
    <div className={`relative h-6 rounded-full overflow-hidden ${className}`} aria-label={`Só mais ${remaining}`}>
      {/* Background (pale) */}
      <div className="absolute inset-0 bg-pink-200" />
      {/* Fill (orange gradient) */}
      <div
        className="absolute left-0 top-0 h-full bg-gradient-to-r from-red-500 via-orange-500 to-yellow-400"
        style={{ width: `${pct}%` }}
      />
      {/* Centered text with flame */}
      <div className="absolute inset-0 flex items-center justify-center gap-2 text-white font-bold text-xs uppercase drop-shadow-sm">
        <Flame className="w-4 h-4" />
        <span>Só mais {remaining}</span>
      </div>
    </div>
  );
};

export default StockUrgencyBar;