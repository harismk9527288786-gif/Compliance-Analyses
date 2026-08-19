import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';

export type RevealPattern =
  | 'random'
  | 'centerOut'
  | 'centerIn'
  | 'topToBottom'
  | 'bottomToTop'
  | 'leftToRight'
  | 'rightToLeft'
  | 'diagonalTopLeft'
  | 'diagonalTopRight'
  | 'diagonalBottomLeft'
  | 'diagonalBottomRight'
  | 'checkerboard';

export interface PixelButtonProProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  variant?: 'primary' | 'secondary' | 'amber' | 'rose' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  pixelSize?: number;
  pixelColor?: string;
  background?: string;
  fontDefaultColor?: string;
  fontHoverColor?: string;
  iconDefaultColor?: string;
  iconHoverColor?: string;
  reveal?: RevealPattern;
  stagger?: number;
  gap?: number;
  className?: string;
}

function hashToUnit(row: number, col: number, rows: number, cols: number): number {
  const seed =
    ((row + 1) * 73856093) ^
    ((col + 1) * 19349663) ^
    (rows * 83492791) ^
    (cols * 2971215073);
  const hashed = Math.imul(seed ^ (seed >>> 16), 2246822507);
  return (hashed >>> 0) / 4294967295;
}

export const PixelButtonPro: React.FC<PixelButtonProProps> = ({
  children,
  icon,
  iconRight,
  iconPosition = 'left',
  variant = 'primary',
  size = 'md',
  pixelSize = 14,
  pixelColor: propPixelColor,
  background: propBackground,
  fontDefaultColor: propFontDefault,
  fontHoverColor: propFontHover,
  iconDefaultColor: propIconDefault,
  iconHoverColor: propIconHover,
  reveal = 'random',
  stagger = 0.03,
  gap = 0,
  className = '',
  disabled = false,
  onClick,
  ...rest
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLButtonElement>(null);
  const [sizeDimensions, setSizeDimensions] = useState({ width: 140, height: 40 });
  const reducedMotion = useReducedMotion();

  const sizeStyles = {
    sm: 'px-3.5 py-1.5 text-xs font-semibold gap-1.5 min-h-[34px]',
    md: 'px-4 py-2 text-xs sm:text-sm font-semibold gap-2 min-h-[40px]',
    lg: 'px-6 py-3 text-sm sm:text-base font-bold gap-2.5 min-h-[48px]',
  };

  const variantConfig = {
    primary: {
      bg: '#090e17',
      pixel: '#10b981', // Emerald
      border: 'border-emerald-500/40',
      hoverBorder: 'hover:border-emerald-400',
      textDefault: '#f8fafc',
      textHover: '#022c22',
      iconDefault: '#34d399', // Emerald-400
      iconHover: '#022c22',   // Dark contrast on emerald
    },
    secondary: {
      bg: '#0f172a',
      pixel: '#38bdf8', // Sky blue
      border: 'border-slate-700',
      hoverBorder: 'hover:border-sky-400',
      textDefault: '#e2e8f0',
      textHover: '#082f49',
      iconDefault: '#38bdf8', // Sky-400
      iconHover: '#082f49',   // Dark contrast on sky
    },
    amber: {
      bg: '#0f172a',
      pixel: '#fbbf24', // Amber
      border: 'border-amber-500/40',
      hoverBorder: 'hover:border-amber-400',
      textDefault: '#fef3c7',
      textHover: '#451a03',
      iconDefault: '#fbbf24', // Amber-400
      iconHover: '#451a03',   // Dark contrast on amber
    },
    rose: {
      bg: '#0f172a',
      pixel: '#f43f5e', // Rose
      border: 'border-rose-500/40',
      hoverBorder: 'hover:border-rose-400',
      textDefault: '#ffe4e6',
      textHover: '#4c0519',
      iconDefault: '#fb7185',
      iconHover: '#4c0519',
    },
    dark: {
      bg: '#050811',
      pixel: '#64748b',
      border: 'border-slate-800',
      hoverBorder: 'hover:border-slate-600',
      textDefault: '#cbd5e1',
      textHover: '#0f172a',
      iconDefault: '#94a3b8',
      iconHover: '#0f172a',
    },
  };

  const currentTheme = variantConfig[variant] || variantConfig.primary;
  const pixelColor = propPixelColor || currentTheme.pixel;
  const background = propBackground || currentTheme.bg;
  const fontDefault = propFontDefault || currentTheme.textDefault;
  const fontHover = propFontHover || currentTheme.textHover;
  const iconDefault = propIconDefault || currentTheme.iconDefault;
  const iconHover = propIconHover || currentTheme.iconHover;


  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateDimensions = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSizeDimensions({ width: rect.width, height: rect.height });
      }
    };

    updateDimensions();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(updateDimensions);
      ro.observe(el);
      return () => ro.disconnect();
    }
  }, []);


  const metrics = useMemo(() => {
    const { width, height } = sizeDimensions;
    const safePixel = Math.max(8, pixelSize);
    const cols = Math.max(1, Math.ceil(width / safePixel));
    const rows = Math.max(1, Math.ceil(height / safePixel));
    const maxDiagonal = Math.max(1, cols + rows - 2);
    return { cols, rows, maxDiagonal };
  }, [sizeDimensions, pixelSize]);


  const cells = useMemo(() => {
    const items = [];
    const { rows, cols, maxDiagonal } = metrics;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let order = 0;
        switch (reveal) {
          case 'random':
            order = hashToUnit(r, c, rows, cols) * maxDiagonal;
            break;
          case 'centerOut': {
            const cr = (rows - 1) / 2;
            const cc = (cols - 1) / 2;
            order = Math.sqrt(Math.pow(r - cr, 2) + Math.pow(c - cc, 2));
            break;
          }
          case 'centerIn': {
            const cr = (rows - 1) / 2;
            const cc = (cols - 1) / 2;
            order = maxDiagonal - Math.sqrt(Math.pow(r - cr, 2) + Math.pow(c - cc, 2));
            break;
          }
          case 'diagonalTopLeft':
            order = r ; c;
            break;
          case 'diagonalBottomRight':
            order = rows - 1 - r + (cols - 1 - c);
            break;
          case 'diagonalTopRight':
            order = r ; (cols - 1 - c);
            break;
          case 'diagonalBottomLeft':
            order = rows - 1 - r + c;
            break;
          case 'leftToRight':
            order = c;
            break;
          case 'rightToLeft':
            order = cols - 1 - c;
            break;
          case 'topToBottom':
            order = r;
            break;
          case 'bottomToTop':
            order = rows - 1 - r;
            break;
          case 'checkerboard':
            order = (r + c) % 2 === 0 ? 0 : 1;
            break;
          default:
            order = hashToUnit(r, c, rows, cols) * maxDiagonal;
        }

        items.push({
          id: `${r}-${c}`,
          delay: order * stagger,
        });
      }
    }
    return items;
  }, [metrics, reveal, stagger]);

  const leadingIcon = iconPosition === 'left' ? icon : null;
  const trailingIcon = iconRight || (iconPosition === 'right' ? icon : null);

  return (
    <button
      ref={containerRef}
      type="button"
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => !disabled && setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
      }}
      className={`relative inline-flex items-center justify-center rounded-lg border overflow-hidden transition-all duration-200 outline-none select-none font-sans ${
        disabled
          ? 'opacity-50 cursor-not-allowed border-slate-800'
          : `cursor-pointer ${currentTheme.border} ${currentTheme.hoverBorder} shadow-xs active:scale-[0.98]`
      } ${sizeStyles[size]} ${className}`}
      style={{
        backgroundColor: background,
      }}
      {...(rest as any)}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none grid"
        style={{
          gridTemplateColumns: `repeat(${metrics.cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${metrics.rows}, minmax(0, 1fr))`,
          gap: `${gap}px`,
        }}
      >
        {cells.map((cell) => (
          <motion.div
            key={cell.id}
            initial={false}
            animate={
              reducedMotion
                ? { opacity: isHovered ? 1 : 0 }
                : {
                    opacity: isHovered ? 1 : 0,
                    scale: isHovered ? 1 : 0.4,
                  }
            }
            transition={{
              duration: 0.22,
              ease: 'easeInOut',
              delay: isHovered ? cell.delay : 0,
            }}
            style={{
              backgroundColor: pixelColor,
              boxShadow: gap === 0 ? `0 0 0 0.5px ${pixelColor}` : undefined,
              transformOrigin: 'center',
            }}
          />
        ))}
      </div>

      <div
        className="relative z-10 flex items-center justify-center gap-1.5 transition-colors duration-200"
        style={{
          color: isHovered ? fontHover : fontDefault,
        }}
      >
        {leadingIcon && (
          <span
            className="inline-flex shrink-0 items-center justify-center transition-colors duration-200 [&>svg]:text-current [&>svg]:stroke-current"
            style={{
              color: isHovered ? iconHover : iconDefault,
            }}
          >
            {leadingIcon}
          </span>
        )}

        {children && <span className="font-semibold tracking-tight">{children}</span>}

        {trailingIcon && (
          <span
            className="inline-flex shrink-0 items-center justify-center transition-colors duration-200 [&>svg]:text-current [&>svg]:stroke-current"
            style={{
              color: isHovered ? iconHover : iconDefault,
            }}
          >
            {trailingIcon}
          </span>
        )}
      </div>
    </button>
  );
};

export default PixelButtonPro;
