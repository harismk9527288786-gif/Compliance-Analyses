import React from 'react';
import { motion } from 'motion/react';

interface FramerShimmerButtonProps {
  onClick?: () => void;
  children: React.ReactNode;
  variant?: 'emerald' | 'indigo' | 'slate' | 'rose';
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  icon?: React.ReactNode;
}

export const FramerShimmerButton: React.FC<FramerShimmerButtonProps> = ({
  onClick,
  children,
  variant = 'emerald',
  className = '',
  disabled = false,
  type = 'button',
  icon,
}) => {
  const variantStyles = {
    emerald: 'bg-[#10B981] hover:bg-[#059669] text-slate-950 border-emerald-400 shadow-emerald-950/20',
    indigo: 'bg-[#6366F1] hover:bg-[#4F46E5] text-white border-indigo-400/40 shadow-indigo-950/30',
    slate: 'bg-slate-900 hover:bg-black text-white border-slate-800 shadow-black/20',
    rose: 'bg-[#E11D48] hover:bg-[#BE123C] text-white border-rose-400 shadow-rose-950/30',
  };

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: disabled ? 1 : 1.025 }}
      whileTap={{ scale: disabled ? 1 : 0.96 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      className={`relative group overflow-hidden px-5 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 border shadow-md transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant]} ${className}`}
    >
      {/* Framer Shimmer Sheen Layer */}
      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />

      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </motion.button>
  );
};
