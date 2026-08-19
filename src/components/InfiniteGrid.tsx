import React, { useRef, useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

export interface InfiniteGridProps {
  /** Size of each square grid cell in pixels */
  cellSize?: number;
  /** Primary grid line color */
  lineColor?: string;
  /** Crosshair intersection marker color */
  crosshairColor?: string;
  /** Glow/spotlight highlight color */
  spotlightColor?: string;
  /** Radius of the cursor spotlight effect in pixels */
  spotlightRadius?: number;
  /** Whether to show crosshairs at grid intersections */
  showCrosshairs?: boolean;
  /** Horizontal animation speed (pixels/sec). Set 0 for static. */
  speedX?: number;
  /** Vertical animation speed (pixels/sec). Set 0 for static. */
  speedY?: number;
  /** Background fill color */
  backgroundColor?: string;
  /** Container custom class name */
  className?: string;
  /** Inner content overlaid on top of the grid */
  children?: React.ReactNode;
  /** Enable radial edge fade mask */
  enableMask?: boolean;
  /** 3D Perspective tilt on mouse move */
  enableTilt?: boolean;
}

export const InfiniteGrid: React.FC<InfiniteGridProps> = ({
  cellSize = 40,
  lineColor = 'rgba(148, 163, 184, 0.15)',
  crosshairColor = 'rgba(16, 185, 129, 0.4)',
  spotlightColor = 'rgba(16, 185, 129, 0.12)',
  spotlightRadius = 300,
  showCrosshairs = true,
  speedX = 12,
  speedY = 12,
  backgroundColor = '#0b0f17',
  className = '',
  children,
  enableMask = true,
  enableTilt = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 });
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setMousePos({ x, y });

      if (enableTilt && !reducedMotion) {
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = ((y - centerY) / centerY) * -6;
        const rotateY = ((x - centerX) / centerX) * 6;
        setTilt({ rotateX, rotateY });
      }
    };

    const handleMouseLeave = () => {
      setMousePos({ x: -1000, y: -1000 });
      setTilt({ rotateX: 0, rotateY: 0 });
    };

    const node = containerRef.current;
    if (node) {
      node.addEventListener('mousemove', handleMouseMove);
      node.addEventListener('mouseleave', handleMouseLeave);
    }
    return () => {
      if (node) {
        node.removeEventListener('mousemove', handleMouseMove);
        node.removeEventListener('mouseleave', handleMouseLeave);
      }
    };
  }, [enableTilt, reducedMotion]);

  const patternId = React.useId().replace(/:/g, '');

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden w-full h-full min-h-[300px] ${className}`}
      style={{
        backgroundColor,
        perspective: enableTilt ? '1000px' : undefined,
      }}
    >
      <motion.div
        className="absolute -inset-[100%] pointer-events-none"
        style={{
          transformStyle: 'preserve-3d',
        }}
        animate={
          reducedMotion
            ? {}
            : {
                x: [0, cellSize],
                y: [0, cellSize],
                rotateX: tilt.rotateX,
                rotateY: tilt.rotateY,
              }
        }
        transition={{
          x: {
            repeat: Infinity,
            repeatType: 'loop',
            duration: Math.abs(speedX) > 0 ? (cellSize / speedX) * 2 : 0,
            ease: 'linear',
          },
          y: {
            repeat: Infinity,
            repeatType: 'loop',
            duration: Math.abs(speedY) > 0 ? (cellSize / speedY) * 2 : 0,
            ease: 'linear',
          },
          rotateX: { type: 'spring', stiffness: 200, damping: 30 },
          rotateY: { type: 'spring', stiffness: 200, damping: 30 },
        }}
      >
        <svg
          className="w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern
              id={patternId}
              width={cellSize}
              height={cellSize}
              patternUnits="userSpaceOnUse"
            >
              <path
                d={`M ${cellSize} 0 L 0 0 0 ${cellSize}`}
                fill="none"
                stroke={lineColor}
                strokeWidth="1"
              />
              {showCrosshairs && (
                <>
                  <path
                    d="M -3 0 L 3 0 M 0 -3 L 0 3"
                    stroke={crosshairColor}
                    strokeWidth="1.5"
                  />
                  <circle cx="0" cy="0" r="1" fill={crosshairColor} />
                </>
              )}
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${patternId})`} />
        </svg>
      </motion.div>

      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none transition-opacity duration-300"
        style={{
          background: `radial-gradient(${spotlightRadius}px circle at ${mousePos.x}px ${mousePos.y}px, ${spotlightColor}, transparent 80%)`,
        }}
      />

      {enableMask && (
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 70% 60% at 50% 50%, transparent 40%, ${backgroundColor} 100%)`,
          }}
        />
      )}

      {children && (
        <div className="relative z-10 w-full h-full flex flex-col justify-center items-center">
          {children}
        </div>
      )}
    </div>
  );
};

export default InfiniteGrid;