import React, { useEffect, useRef, memo } from 'react';
import './DotField.css';

const TWO_PI = Math.PI * 2;

interface Dot {
  ax: number;
  ay: number;
}

interface DotFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  dotRadius?: number;
  dotSpacing?: number;
  gridLines?: boolean;
  gridLineColor?: string;
  gridLineWidth?: number;
  dotColor?: string;
}

const DotField = memo<DotFieldProps>(({
  dotRadius = 1.1,
  dotSpacing = 28,
  dotColor = 'rgba(64, 41, 112, 0.18)', // dark purple dots for light theme
  gridLines = true,
  gridLineColor = 'rgba(64, 41, 112, 0.05)', // faint lines for light theme
  gridLineWidth = 0.6,
  className = '',
  style,
  ...rest
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotsRef = useRef<Dot[]>([]);
  const sizeRef = useRef({ w: 0, h: 0, cols: 0, rows: 0 });
  const rafRef = useRef<number | null>(null);
  const propsRef = useRef<any>({});
  
  propsRef.current = { 
    dotRadius, 
    dotSpacing, 
    dotColor, 
    gridLines,
    gridLineColor,
    gridLineWidth
  };
  
  const rebuildRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let resizeTimer: any;

    function resize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(doResize, 100);
    }

    function doResize() {
      if (!canvas || !ctx) return;
      const rect = canvas.parentElement!.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      sizeRef.current.w = w;
      sizeRef.current.h = h;

      buildDots(w, h);
    }

    function buildDots(w: number, h: number) {
      const p = propsRef.current;
      const step = p.dotRadius + p.dotSpacing;
      const cols = Math.floor(w / step);
      const rows = Math.floor(h / step);
      
      sizeRef.current.cols = cols;
      sizeRef.current.rows = rows;
      
      const padX = (w % step) / 2;
      const padY = (h % step) / 2;
      const dots = new Array(rows * cols);
      let idx = 0;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const ax = padX + col * step + step / 2;
          const ay = padY + row * step + step / 2;
          dots[idx++] = { ax, ay };
        }
      }
      dotsRef.current = dots;
    }

    function tick() {
      const dots = dotsRef.current;
      const { w, h, cols, rows } = sizeRef.current;
      const p = propsRef.current;
      const len = dots.length;

      const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

      if (ctx) {
        ctx.clearRect(0, 0, w, h);

        // 1. Draw grid lines (mesh warped background - static)
        if (p.gridLines && cols > 0 && rows > 0) {
          ctx.strokeStyle = isDark ? 'rgba(167, 139, 250, 0.05)' : p.gridLineColor;
          ctx.lineWidth = p.gridLineWidth;
          ctx.beginPath();

          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const idx = r * cols + c;
              const d = dots[idx];
              if (!d) continue;

              // Connect to right neighbor
              if (c < cols - 1) {
                const rightD = dots[idx + 1];
                if (rightD) {
                  ctx.moveTo(d.ax, d.ay);
                  ctx.lineTo(rightD.ax, rightD.ay);
                }
              }

              // Connect to bottom neighbor
              if (r < rows - 1) {
                const bottomD = dots[idx + cols];
                if (bottomD) {
                  ctx.moveTo(d.ax, d.ay);
                  ctx.lineTo(bottomD.ax, bottomD.ay);
                }
              }
            }
          }
          ctx.stroke();
        }

        // 2. Draw dots
        ctx.fillStyle = isDark ? 'rgba(167, 139, 250, 0.18)' : p.dotColor;
        ctx.beginPath();
        const rad = p.dotRadius;

        for (let i = 0; i < len; i++) {
          const d = dots[i];
          if (!d) continue;
          ctx.moveTo(d.ax + rad, d.ay);
          ctx.arc(d.ax, d.ay, rad, 0, TWO_PI);
        }
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    doResize();
    window.addEventListener('resize', resize);
    rafRef.current = requestAnimationFrame(tick);

    rebuildRef.current = () => {
      const { w, h } = sizeRef.current;
      if (w > 0 && h > 0) buildDots(w, h);
    };

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', resize);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    rebuildRef.current?.();
  }, [dotRadius, dotSpacing]);

  return (
    <div className={`dot-field-container ${className}`} style={style} {...rest}>
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
        }}
      />
    </div>
  );
});

DotField.displayName = 'DotField';

export default DotField;
