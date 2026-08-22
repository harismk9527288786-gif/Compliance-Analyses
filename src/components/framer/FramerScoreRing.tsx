import React from 'react';
import { motion } from 'motion/react';

interface FramerScoreRingProps {
  passedCount?: number;
  deviationCount?: number;
  gapCount?: number;
  totalCount?: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
}

export const FramerScoreRing: React.FC<FramerScoreRingProps> = ({
  passedCount = 0,
  deviationCount = 0,
  gapCount = 0,
  totalCount,
  size = 120,
  strokeWidth = 11,
  label = 'Quality Index',
  sublabel = 'Deterministic Compliance',
}) => {
  const calculatedTotal = totalCount || (passedCount + deviationCount + gapCount) || 1;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Segment proportions
  const passRatio = calculatedTotal > 0 ? passedCount / calculatedTotal : 0;
  const devRatio = calculatedTotal > 0 ? deviationCount / calculatedTotal : 0;
  const gapRatio = calculatedTotal > 0 ? gapCount / calculatedTotal : 0;

  const passLength = passRatio * circumference;
  const devLength = devRatio * circumference;
  const gapLength = gapRatio * circumference;

  const passPercent = Math.round(passRatio * 100);

  return (
    <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 shadow-sm text-white">
      <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Base Background Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(255, 255, 255, 0.1)"
            strokeWidth={strokeWidth}
            fill="transparent"
          />

          {/* 1. 🟢 Emerald Green Segment (Passed / Conforming) - Fast Snappy 0.25s */}
          {passedCount > 0 && (
            <motion.circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="#10B981"
              strokeWidth={strokeWidth}
              strokeDasharray={`${passLength} ${circumference}`}
              strokeDashoffset={0}
              initial={{ strokeDasharray: `0 ${circumference}` }}
              animate={{ strokeDasharray: `${passLength} ${circumference}` }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              fill="transparent"
            />
          )}

          {/* 2. 🔴 Crimson Red Segment (Deviations) - Fast Snappy 0.25s */}
          {deviationCount > 0 && (
            <motion.circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="#F43F5E"
              strokeWidth={strokeWidth}
              strokeDasharray={`${devLength} ${circumference}`}
              strokeDashoffset={-passLength}
              initial={{ strokeDasharray: `0 ${circumference}` }}
              animate={{ strokeDasharray: `${devLength} ${circumference}` }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              fill="transparent"
            />
          )}

          {/* 3. 🟠 Amber / Orange Segment (Documentation Gaps) - Fast Snappy 0.25s */}
          {gapCount > 0 && (
            <motion.circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="#F59E0B"
              strokeWidth={strokeWidth}
              strokeDasharray={`${gapLength} ${circumference}`}
              strokeDashoffset={-(passLength + devLength)}
              initial={{ strokeDasharray: `0 ${circumference}` }}
              animate={{ strokeDasharray: `${gapLength} ${circumference}` }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              fill="transparent"
            />
          )}
        </svg>

        {/* Center Ratio Display (e.g. 29/33 PASSED) */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-1">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="font-mono font-black text-base sm:text-lg tracking-tight leading-none text-white"
          >
            <span className="flex items-baseline justify-center">
              <span className="text-[#34D399]">{passedCount}</span>
              <span className="text-white/60 text-xs sm:text-sm font-bold">/{calculatedTotal}</span>
            </span>
          </motion.div>
          <span className="text-[9px] font-black uppercase tracking-wider text-emerald-300 mt-1 leading-none">
            PASSED
          </span>
        </div>
      </div>

      <div className="space-y-1 min-w-0">
        <div className="text-xs font-black uppercase tracking-wider text-white">
          {label}
        </div>
        <div className="text-[11px] text-slate-300 font-medium">
          {sublabel}
        </div>

        {/* Tri-Color Condition Badges */}
        <div className="flex items-center gap-2.5 pt-1 text-[10px] font-mono font-bold flex-wrap">
          <span className="inline-flex items-center gap-1 text-[#34D399]">
            <span className="w-2 h-2 rounded-full bg-[#10B981]" />
            <span>{passedCount} Pass ({passPercent}%)</span>
          </span>

          {deviationCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[#FDA4AF]">
              <span className="w-2 h-2 rounded-full bg-[#F43F5E]" />
              <span>{deviationCount} Dev</span>
            </span>
          )}

          {gapCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[#FDE68A]">
              <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
              <span>{gapCount} Gap</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
