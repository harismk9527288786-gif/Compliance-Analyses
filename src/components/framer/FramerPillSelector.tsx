import React from 'react';
import { motion } from 'motion/react';

export interface PillOption {
  id: string;
  label: string;
  count?: number;
  badgeColor?: string;
}

interface FramerPillSelectorProps {
  options: PillOption[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
  activeBgColor?: string;
  activeTextColor?: string;
}

export const FramerPillSelector: React.FC<FramerPillSelectorProps> = ({
  options,
  activeId,
  onChange,
  className = '',
  activeBgColor = 'bg-[#0B0F19]',
  activeTextColor = 'text-white',
}) => {
  return (
    <div className={`inline-flex items-center gap-1 bg-slate-100 p-1.5 rounded-full border border-slate-200 shadow-2xs ${className}`}>
      {options.map((opt) => {
        const isActive = activeId === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`relative px-4 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer select-none z-10 flex items-center gap-1.5 ${
              isActive ? activeTextColor : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="framerActivePill"
                className={`absolute inset-0 rounded-full ${activeBgColor} shadow-sm -z-10`}
                transition={{
                  type: 'spring',
                  stiffness: 750,
                  damping: 32,
                }}
              />
            )}
            <span>{opt.label}</span>
            {opt.count !== undefined && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : opt.badgeColor || 'bg-slate-200 text-slate-700'
                }`}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
