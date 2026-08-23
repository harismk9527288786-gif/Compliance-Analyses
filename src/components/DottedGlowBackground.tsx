import React, { useState, useEffect, useRef } from 'react';

interface DottedGlowBackgroundProps {
  children?: React.ReactNode;
  className?: string;
  variant?: 'light' | 'dark';
  dotSize?: number;
  dotSpacing?: number;
  dotColor?: string;
  primaryGlowColor?: string;
  secondaryGlowColor?: string;
  interactive?: boolean;
}

export const DottedGlowBackground: React.FC<DottedGlowBackgroundProps> = ({
  children,
  className = '',
  variant = 'light',
  dotSize = 1.5,
  dotSpacing = 24,
  dotColor,
  primaryGlowColor,
  secondaryGlowColor,
  interactive = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: -1000, y: -1000 });
  const [isHovered, setIsHovered] = useState(false);
  const [isOverCard, setIsOverCard] = useState(false);

  const isDark = variant === 'dark';

  const finalBgColor = isDark ? '#020617' : '#f1f5f9';
  const finalDotColor = dotColor || (isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(100, 116, 139, 0.25)');
  const finalPrimaryGlow = primaryGlowColor || (isDark ? 'rgba(16, 185, 129, 0.22)' : 'rgba(16, 185, 129, 0.16)');
  const finalSecondaryGlow = secondaryGlowColor || (isDark ? 'rgba(14, 165, 233, 0.16)' : 'rgba(14, 165, 233, 0.12)');

  useEffect(() => {
    if (!interactive) return;

    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({
        x: e.clientX,
        y: e.clientY,
      });

      // Check if mouse is directly over any foreground card, button, table, input, or modal
      const target = e.target as HTMLElement | null;
      if (
        target &&
        target.closest(
          'button, a, input, select, textarea, table, tbody, thead, [role="button"], [role="tab"], [role="dialog"], header, nav, .bg-white, .bg-slate-900, .bg-slate-950, section'
        )
      ) {
        setIsOverCard(true);
      } else {
        setIsOverCard(false);
      }
    };

    const handleMouseEnter = () => setIsHovered(true);
    const handleMouseLeave = () => {
      setIsHovered(false);
      setIsOverCard(false);
      setMousePos({ x: -1000, y: -1000 });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.body.addEventListener('mouseenter', handleMouseEnter);
    document.body.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.body.removeEventListener('mouseenter', handleMouseEnter);
      document.body.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [interactive]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full min-h-screen overflow-x-hidden ${className}`}
      style={{
        backgroundColor: finalBgColor,
      }}
    >
      {/* BACKGROUND LAYER (Strictly z-0, behind all components and cards) */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* 1. Base Dotted Grid Pattern with smooth vignette mask */}
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, ${finalDotColor} ${dotSize}px, transparent 0)`,
            backgroundSize: `${dotSpacing}px ${dotSpacing}px`,
            maskImage: 'radial-gradient(ellipse 95% 85% at 50% 35%, #000 65%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 95% 85% at 50% 35%, #000 65%, transparent 100%)',
          }}
        />

        {/* 2. Top-Center Ambient Emerald Glow Orb */}
        <div
          className="absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[480px] blur-3xl opacity-75 animate-pulse z-0"
          style={{
            background: `radial-gradient(circle, ${finalPrimaryGlow} 0%, transparent 70%)`,
            animationDuration: '7s',
          }}
        />

        {/* 3. Secondary Right-Side Ambient Sky Glow Orb */}
        <div
          className="absolute top-1/4 -right-40 w-[650px] h-[550px] blur-3xl opacity-60 z-0"
          style={{
            background: `radial-gradient(circle, ${finalSecondaryGlow} 0%, transparent 70%)`,
          }}
        />

        {/* 4. Tertiary Left-Bottom Ambient Emerald Accent */}
        <div
          className="absolute bottom-10 -left-32 w-[550px] h-[550px] blur-3xl opacity-50 z-0"
          style={{
            background: `radial-gradient(circle, ${finalPrimaryGlow} 0%, transparent 70%)`,
          }}
        />

        {/* 5. Interactive Cursor Glow (Behind all content & hidden when hovering over cards) */}
        {interactive && isHovered && (
          <div
            className="absolute pointer-events-none z-0"
            style={{
              left: `${mousePos.x}px`,
              top: `${mousePos.y}px`,
              transform: 'translate(-50%, -50%)',
              width: '380px',
              height: '380px',
              opacity: isOverCard ? 0 : 1,
              transition: 'opacity 0.22s ease-out',
              background: isDark
                ? 'radial-gradient(circle, rgba(16, 185, 129, 0.28) 0%, rgba(14, 165, 233, 0.12) 40%, transparent 70%)'
                : 'radial-gradient(circle, rgba(16, 185, 129, 0.22) 0%, rgba(14, 165, 233, 0.10) 40%, transparent 70%)',
              borderRadius: '9999px',
              filter: 'blur(35px)',
            }}
          />
        )}
      </div>

      {/* FOREGROUND CONTENT LAYER (Isolated above background z-0, solid cards render cleanly on top) */}
      <div className="relative z-10 isolate w-full max-w-full flex flex-col min-h-screen min-w-0">
        {children}
      </div>
    </div>
  );
};
