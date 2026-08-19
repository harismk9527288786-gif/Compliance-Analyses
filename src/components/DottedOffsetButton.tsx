import React, { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

export interface DatedOffsetButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
  /** Legacy compatibility text prop */
  text?: string;
  /** Legacy compatibility label prop */
  label?: string;
  /** Optional leading icon */
  icon?: React.ReactNode;
  /** Optional trailing icon */
  iconRight?: React.ReactNode;
  /** Legacy leading icon prop */
  iconLeft?: React.ReactNode;
  /** Icon placement when using icon prop */
  iconPosition?: 'left' | 'right';
  /** Visual variant */
  variant?: 'primary' | 'secondary' | 'dark' | 'outline';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Horizontal offset distance in pixels */
  shadowX?: number;
  /** Vertical offset distance in pixels */
  shadowY?: number;
  /** Legacy offset distance */
  offsetSize?: number;
  /** Custom dotted background color */
  dotColor?: string;
  /** Custom button background */
  bgColor?: string;
  /** Custom border color */
  borderColor?: string;
  /** Custom text color */
  textColor?: string;
  /** Explicit reduced motion override */
  reducedMotion?: boolean;
}

export const DottedOffsetButton: React.FC<DatedOffsetButtonProps> = ({
  children,
  text,
  label,
  icon,
  iconRight,
  iconLeft,
  iconPosition = 'left',
  variant = 'primary',
  size = 'md',
  shadowX: propShadowX,
  shadowY: propShadowY,
  offsetSize = 5,
  dotColor,
  bgColor,
  borderColor,
  textColor,
  className = '',
  disabled = false,
  onClick,
  reducedMotion: propReducedMotion,
  ...rest
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const systemReducedMotion = useReducedMotion();
  const shouldReduceMotion = propReducedMotion ?? systemReducedMotion;

  const shadowX = propShadowX ?? offsetSize;
  const shadowY = propShadowY ?? offsetSize;

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs font-semibold gap-1.5',
    md: 'px-4 py-2 text-sm font-semibold gap-2',
    lg: 'px-6 py-3 text-base font-bold gap-2.5',
  };

  const variantStyles = {
    primary: {
      bg: 'bg-emerald-600',
      text: 'text-white',
      border: 'border-emerald-700',
      dotBg: 'bg-emerald-950',
      dots: '#059669',
    },
    secondary: {
      bg: 'bg-slate-800',
      text: 'text-slate-100',
      border: 'border-slate-700',
      dotBg: 'bg-slate-900',
      dots: '#64748b',
    },
    dark: {
      bg: 'bg-slate-950',
      text: 'text-slate-100',
      border: 'border-slate-800',
      dotBg: 'bg-black',
      dots: '#334155',
    },
    outline: {
      bg: 'bg-white',
      text: 'text-slate-900',
      border: 'border-slate-300',
      dotBg: 'bg-slate-100',
      dots: '#94a388',
    },
  };

  const currentVariant = variantStyles[variant] || variantStyles.primary;

  const buttonContent = children ?? text ?? label;
  const leadingIcon = iconLeft ?? (iconPosition === 'left' ? icon : null);
  const trailingIcon = iconRight ?? (iconPosition === 'right' ? icon : null);

  const animateTransform = shouldReduceMotion
    ? { x: 0, y: 0 }
    : isPressed
    ? { x: shadowX * 0.5, y: shadowY * 0.5 }
    : isHovered
    ? { x: shadowX, y: shadowY }
    : { x: 0, y: 0 };

  return (
    <div
      className={`inline-block relative select-none ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
      style={{
        paddingRight: `${shadowX}px`,
        paddingBottom: `${shadowY}px`,
      }}
      onMouseEnter={() => !disabled && setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsPressed(false);
      }}
    >
      <div
        aria-hidden="true"
        className={`absolute inset-0 rounded-lg border ${borderColor || currentVariant.border} pointer-events-none`}
        style={{
          width: `calc(100% - ${shadowX}px)`,
          height: `calc(100% - ${shadowY}px)`,
          top: 0,
          left: 0,
          backgroundImage: `radial-gradient(${dotColor || currentVariant.dots} 1.5px, transparent 1.5px)`,
          backgroundSize: '6px 6px',
        }}
      />
      <motion.button
        type="button"
        disabled={disabled}
        onClick={onClick}
        animate={animateTransform}
        transition={{
          type: 'spring',
          stiffness: 450,
          damping: 25,
          mass: 0.8,
        }}
        onMouseDown={() => !disabled && setIsPressed(true)}
        onMouseUp={() => !disabled && setIsPressed(false)}
        className={`relative z-10 flex items-center justify-center rounded-lg border font-sans leading-none shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${sizeStyles[size]} ${bgColor || currentVariant.bg} ${textColor || currentVariant.text} ${borderColor || currentVariant.border} ${className}`}
        {...(rest as any)}
      >
        {leadingIcon && (
          <span className="inline-flex shrink-0 items-center justify-center">
            {leadingIcon}
          </span>
        )}
        {buttonContent && <span>{buttonContent}</span>}
        {trailingIcon && (
          <span className="inline-flex shrink-0 items-center justify-center">
            {trailingIcon}
          </span>
        )}
      </motion.button>
    </div>
  );
};

export default DottedOffsetButton;
