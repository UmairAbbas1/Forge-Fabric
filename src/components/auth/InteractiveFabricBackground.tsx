import React, { useEffect, useRef, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import gsap from "gsap";

/**
 * FORGE & FABRIC — GARMENT CONVERSION INTERACTIVE ATELIER
 * 
 * An artisan, non-blue luxury atelier environment featuring:
 * 1. Physical Verlet Cloth & Dynamic Garment Conversion Seam Engine
 * 2. Interactive Gold Bobbin Filament & Tailor's Needle Physics
 * 3. Anisotropic Warm Charcoal / Champagne Silk Textile Shader
 * 4. 3D Gyroscopic Light Reflection specifically tuned to make the Royal Blue Logo pop with jewel-grade brilliance
 */

interface ClothVertex {
  x: number;
  y: number;
  originX: number;
  originY: number;
  vx: number;
  vy: number;
  mass: number;
}

interface SeamPoint {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  angle: number;
}

interface ThreadParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  maxAlpha: number;
  size: number;
  life: number;
  maxLife: number;
}

interface StitchKnot {
  x: number;
  y: number;
  opacity: number;
  life: number;
}

export const InteractiveFabricBackground: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logoWrapperRef = useRef<HTMLDivElement>(null);
  const logoImgRef = useRef<HTMLImageElement>(null);

  const pointerState = useRef<{
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    prevX: number;
    prevY: number;
    vx: number;
    vy: number;
    speed: number;
    active: boolean;
    trail: Array<{ x: number; y: number; time: number }>;
  }>({
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    prevX: 0,
    prevY: 0,
    vx: 0,
    vy: 0,
    speed: 0,
    active: false,
    trail: [],
  });

  // Track mouse coordinates for 3D logo perspective and physical cloth interaction
  const handlePointerMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const p = pointerState.current;
    p.vx = x - p.prevX;
    p.vy = y - p.prevY;
    p.speed = Math.min(Math.sqrt(p.vx * p.vx + p.vy * p.vy), 50);
    p.prevX = x;
    p.prevY = y;
    p.targetX = x;
    p.targetY = y;
    p.active = true;

    // Add to interactive tailor's thread trail
    p.trail.push({ x, y, time: performance.now() });
    if (p.trail.length > 28) p.trail.shift();

    // 3D Parallax Tilt with natural inertial easing
    if (logoWrapperRef.current) {
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = ((y - centerY) / centerY) * -11;
      const rotateY = ((x - centerX) / centerX) * 11;

      gsap.to(logoWrapperRef.current, {
        rotateX,
        rotateY,
        transformPerspective: 1200,
        ease: "power2.out",
        duration: 0.65,
      });
    }

    // Dynamic physical studio shadow casting (Light source opposite the mouse)
    if (logoImgRef.current) {
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const shadowX = -((x - centerX) / centerX) * 22;
      const shadowY = 20 - ((y - centerY) / centerY) * 14;
      logoImgRef.current.style.filter = `drop-shadow(${shadowX}px ${shadowY}px 32px rgba(0, 0, 0, 0.85)) drop-shadow(0 0 20px rgba(0, 113, 227, 0.4))`;
    }
  }, []);

  const handlePointerLeave = () => {
    pointerState.current.active = false;
    if (logoWrapperRef.current) {
      gsap.to(logoWrapperRef.current, {
        rotateX: 0,
        rotateY: 0,
        ease: "elastic.out(1, 0.4)",
        duration: 1.4,
      });
    }
    if (logoImgRef.current) {
      logoImgRef.current.style.filter = `drop-shadow(0 20px 36px rgba(0, 0, 0, 0.8)) drop-shadow(0 0 16px rgba(0, 113, 227, 0.35))`;
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animFrame: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 540);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 950);

    const onResize = () => {
      if (!canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
      buildClothMesh();
      buildGarmentContourSeams();
    };

    window.addEventListener("resize", onResize);

    // ── 1. Verlet Interactive Textile Mesh ──
    const cols = 24;
    const rows = 32;
    let clothGrid: ClothVertex[][] = [];

    const buildClothMesh = () => {
      clothGrid = [];
      for (let r = 0; r <= rows; r++) {
        const row: ClothVertex[] = [];
        const y = (height / rows) * r;
        for (let c = 0; c <= cols; c++) {
          const x = (width / cols) * c;
          row.push({
            x,
            y,
            originX: x,
            originY: y,
            vx: 0,
            vy: 0,
            mass: 1.0,
          });
        }
        clothGrid.push(row);
      }
    };

    // ── 2. Garment Conversion Seam Curves (Pattern Panels Transforming to Finished Garment) ──
    let seamLines: Array<{ path: Array<{ x: number; y: number }>; progress: number; speed: number; gold: boolean }> = [];

    const buildGarmentContourSeams = () => {
      seamLines = [];
      
      // Sleeve / Raglan Curve 1
      const p1: Array<{ x: number; y: number }> = [];
      for (let t = 0; t <= 1; t += 0.04) {
        const x = width * 0.1 + Math.sin(t * Math.PI) * (width * 0.35);
        const y = height * 0.2 + t * (height * 0.55);
        p1.push({ x, y });
      }
      seamLines.push({ path: p1, progress: 0, speed: 0.003, gold: true });

      // Bodice Side Dart / Waist Seam
      const p2: Array<{ x: number; y: number }> = [];
      for (let t = 0; t <= 1; t += 0.04) {
        const x = width * 0.88 - Math.sin(t * Math.PI * 1.2) * (width * 0.32);
        const y = height * 0.18 + t * (height * 0.62);
        p2.push({ x, y });
      }
      seamLines.push({ path: p2, progress: 0.5, speed: 0.0025, gold: false });

      // Shoulder Yoke Arch
      const p3: Array<{ x: number; y: number }> = [];
      for (let t = 0; t <= 1; t += 0.04) {
        const x = width * 0.15 + t * (width * 0.7);
        const y = height * 0.72 + Math.sin(t * Math.PI) * (height * 0.08);
        p3.push({ x, y });
      }
      seamLines.push({ path: p3, progress: 0.2, speed: 0.0035, gold: true });
    };

    // ── 3. Golden Tailor's Filament & Micro-Fiber Dust ──
    const maxThreads = 40;
    const threadParticles: ThreadParticle[] = [];

    const createThreadParticle = (): ThreadParticle => ({
      x: Math.random() * width,
      y: height + Math.random() * 40,
      vx: (Math.random() - 0.5) * 0.45,
      vy: -(0.35 + Math.random() * 0.75),
      alpha: 0,
      maxAlpha: 0.15 + Math.random() * 0.35,
      size: 1 + Math.random() * 2.5,
      life: 0,
      maxLife: 220 + Math.random() * 260,
    });

    for (let i = 0; i < maxThreads; i++) {
      const tp = createThreadParticle();
      tp.y = Math.random() * height;
      tp.life = Math.random() * tp.maxLife;
      threadParticles.push(tp);
    }

    // Dynamic stitch knot buffer
    const stitchKnots: StitchKnot[] = [];

    buildClothMesh();
    buildGarmentContourSeams();

    let time = 0;

    const renderLoop = () => {
      time += 0.016;
      ctx.clearRect(0, 0, width, height);

      const p = pointerState.current;
      p.x += (p.targetX - p.x) * 0.1;
      p.y += (p.targetY - p.y) * 0.1;

      // Clean old trail points
      const now = performance.now();
      p.trail = p.trail.filter((pt) => now - pt.time < 450);

      // ── Step A: Non-Blue Luxury Atelier Palette (Deep Obsidian Velvet & Warm Charcoal Silk) ──
      const atelierBg = ctx.createRadialGradient(
        width * 0.5,
        height * 0.44,
        40,
        width * 0.5,
        height * 0.44,
        Math.max(width, height) * 0.95
      );
      // Rich charcoal & warm amber undertones that make the Royal Blue Logo pop like a jewel
      atelierBg.addColorStop(0, "#1A1C24");   // Warm Champagne-Lit Core behind logo
      atelierBg.addColorStop(0.35, "#12141A"); // Deep Raw Carbon Fabric
      atelierBg.addColorStop(0.75, "#0B0C10"); // Obsidian Atelier Shadows
      atelierBg.addColorStop(1, "#060709");    // Midnight Edge
      ctx.fillStyle = atelierBg;
      ctx.fillRect(0, 0, width, height);

      // ── Step B: Warm Studio Luminaire Highlight (Golden Key Light for Blue Emblem) ──
      const keyLight = ctx.createRadialGradient(
        width * 0.5,
        height * 0.44,
        15,
        width * 0.5,
        height * 0.44,
        width * 0.65
      );
      keyLight.addColorStop(0, "rgba(245, 158, 11, 0.12)");  // Warm Amber Glow
      keyLight.addColorStop(0.45, "rgba(255, 255, 255, 0.04)"); // Soft Daylight Titanium
      keyLight.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = keyLight;
      ctx.fillRect(0, 0, width, height);

      // ── Step C: Physical Cloth Verlet Relaxation & Interactive Ripple ──
      const mouseRadius = 160;

      for (let r = 0; r <= rows; r++) {
        for (let c = 0; c <= cols; c++) {
          const pt = clothGrid[r][c];

          // Harmonic organic drape breeze
          const drapeWave =
            Math.sin(time * 1.5 + pt.originX * 0.006 + pt.originY * 0.005) * 3.8 +
            Math.cos(time * 0.9 + pt.originX * 0.004) * 2.2;

          // Interactive cursor cloth displacement
          if (p.active) {
            const dx = pt.x - p.x;
            const dy = pt.y - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < mouseRadius && dist > 0) {
              const force = (1 - dist / mouseRadius) * 26;
              const angle = Math.atan2(dy, dx);
              pt.vx += Math.cos(angle) * force * 0.2;
              pt.vy += Math.sin(angle) * force * 0.2;
            }
          }

          // Spring return to origin
          const targetX = pt.originX;
          const targetY = pt.originY + drapeWave;
          const k = 0.07;
          const damping = 0.83;

          pt.vx += (targetX - pt.x) * k;
          pt.vy += (targetY - pt.y) * k;
          pt.vx *= damping;
          pt.vy *= damping;
          pt.x += pt.vx;
          pt.y += pt.vy;
        }
      }

      // ── Step D: Render Weft (Horizontal) Charcoal & Champagne Loom Strands ──
      ctx.lineWidth = 1.0;
      for (let r = 1; r < rows; r += 2) {
        ctx.beginPath();
        const yNorm = r / rows;
        const alpha = Math.sin(yNorm * Math.PI) * 0.14 + 0.04;
        ctx.strokeStyle = `rgba(226, 232, 240, ${alpha})`; // Warm Slate Sheen

        ctx.moveTo(clothGrid[r][0].x, clothGrid[r][0].y);
        for (let c = 1; c <= cols; c++) {
          const prev = clothGrid[r][c - 1];
          const curr = clothGrid[r][c];
          const midX = (prev.x + curr.x) * 0.5;
          const midY = (prev.y + curr.y) * 0.5;
          ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
        }
        ctx.stroke();
      }

      // ── Step E: Render Warp (Vertical) Tension Yarns ──
      for (let c = 2; c < cols; c += 3) {
        ctx.beginPath();
        const xNorm = c / cols;
        const alpha = Math.sin(xNorm * Math.PI) * 0.12 + 0.03;
        ctx.strokeStyle = `rgba(212, 175, 55, ${alpha * 0.65})`; // Warm Gold Yarn Sheen

        ctx.moveTo(clothGrid[0][c].x, clothGrid[0][c].y);
        for (let r = 1; r <= rows; r++) {
          const prev = clothGrid[r - 1][c];
          const curr = clothGrid[r][c];
          const midX = (prev.x + curr.x) * 0.5;
          const midY = (prev.y + curr.y) * 0.5;
          ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
        }
        ctx.stroke();
      }

      // ── Step F: Garment Conversion Contours & Stitch Lines (Pattern Assembly) ──
      seamLines.forEach((seam) => {
        seam.progress = (seam.progress + seam.speed) % 1;

        ctx.beginPath();
        seam.path.forEach((pt, i) => {
          // Add subtle cloth drape wave
          const waveY = pt.y + Math.sin(time * 1.8 + pt.x * 0.01) * 3;
          if (i === 0) ctx.moveTo(pt.x, waveY);
          else ctx.lineTo(pt.x, waveY);
        });

        // Elegant dashed tailor's seam
        ctx.setLineDash([7, 6]);
        ctx.strokeStyle = seam.gold ? "rgba(245, 158, 11, 0.28)" : "rgba(203, 213, 225, 0.18)";
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.setLineDash([]); // Reset dash

        // Moving Golden Stitch Knot along the seam
        const knotIndex = Math.floor(seam.progress * (seam.path.length - 1));
        const knotPt = seam.path[knotIndex];
        if (knotPt) {
          ctx.beginPath();
          ctx.arc(knotPt.x, knotPt.y + Math.sin(time * 1.8 + knotPt.x * 0.01) * 3, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(251, 191, 36, 0.75)"; // Luminous Amber Gold Knot
          ctx.shadowColor = "rgba(245, 158, 11, 0.8)";
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });

      // ── Step G: Interactive Tailor's Golden Filament (Drawn by Cursor) ──
      if (p.trail.length > 2) {
        ctx.beginPath();
        ctx.moveTo(p.trail[0].x, p.trail[0].y);
        for (let i = 1; i < p.trail.length; i++) {
          const xc = (p.trail[i - 1].x + p.trail[i].x) * 0.5;
          const yc = (p.trail[i - 1].y + p.trail[i].y) * 0.5;
          ctx.quadraticCurveTo(p.trail[i - 1].x, p.trail[i - 1].y, xc, yc);
        }

        ctx.strokeStyle = "rgba(251, 191, 36, 0.45)"; // Gold Tailor Thread
        ctx.lineWidth = 1.6;
        ctx.shadowColor = "rgba(245, 158, 11, 0.6)";
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Needle tip at the cursor
        const last = p.trail[p.trail.length - 1];
        ctx.beginPath();
        ctx.arc(last.x, last.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#FDE68A";
        ctx.fill();
      }

      // ── Step H: Floating Golden Fibers / Micro-Yarn Filament Dust ──
      threadParticles.forEach((tp, idx) => {
        tp.x += tp.vx + Math.sin(time * 1.2 + tp.y * 0.01) * 0.4;
        tp.y += tp.vy;
        tp.life++;

        if (tp.life < tp.maxLife * 0.3) {
          tp.alpha = (tp.life / (tp.maxLife * 0.3)) * tp.maxAlpha;
        } else if (tp.life > tp.maxLife * 0.7) {
          tp.alpha = ((tp.maxLife - tp.life) / (tp.maxLife * 0.3)) * tp.maxAlpha;
        }

        ctx.beginPath();
        ctx.arc(tp.x, tp.y, tp.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(245, 158, 11, ${tp.alpha * 0.7})`; // Warm Gold Flecks
        ctx.fill();

        if (tp.y < -20 || tp.life >= tp.maxLife || tp.x < -20 || tp.x > width + 20) {
          threadParticles[idx] = createThreadParticle();
        }
      });

      animFrame = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      onMouseMove={handlePointerMove}
      onMouseLeave={handlePointerLeave}
      className="hidden lg:flex lg:w-5/12 h-screen sticky top-0 p-8 items-center justify-center flex-col relative overflow-hidden z-20 select-none bg-[#0B0C10]"
      style={{ perspective: 1400 }}
    >
      {/* 1. Dynamic Garment Conversion Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
      />

      {/* 2. Top Left: Return to Home */}
      <Link
        to="/"
        className="absolute top-8 left-8 z-30 flex items-center gap-2 text-xs font-semibold text-neutral-300 hover:text-white bg-neutral-900/80 hover:bg-neutral-800 px-4 py-2 rounded-full border border-amber-500/30 backdrop-blur-md transition-all shadow-md hover:border-amber-400 group"
        title="Return to Home Landing Page"
      >
        <ArrowLeft className="w-4 h-4 text-amber-400 group-hover:-translate-x-1 transition-transform" />
        <span>Back to Home</span>
      </Link>

      {/* 3. Centerpiece: Sculpted Blue Emblem & Pure Human Typography */}
      <div
        ref={logoWrapperRef}
        className="z-20 flex flex-col items-center justify-center relative pointer-events-auto"
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* Warm Studio Light Halo (Guarantees the Royal Blue 3D Logo pops with 100% clarity) */}
        <div className="absolute -inset-16 rounded-full bg-gradient-to-tr from-amber-500/10 via-white/5 to-amber-400/10 blur-3xl pointer-events-none opacity-80" />

        <Link
          to="/"
          className="relative z-10 flex flex-col items-center justify-center gap-6 cursor-pointer group"
        >
          {/* Logo Mark with Directional Studio Shadow */}
          <div className="relative">
            <img
              ref={logoImgRef}
              src="/SVG_MARK.svg"
              alt="Forge & Fabric Industries, Inc. Logo"
              draggable={false}
              data-no-lens="true"
              data-lens-widget="false"
              data-no-search="true"
              className="w-56 h-56 md:w-64 md:h-64 object-contain pointer-events-none select-none transform group-hover:scale-[1.03] transition-all duration-500"
              style={{
                filter: "drop-shadow(0 20px 36px rgba(0, 0, 0, 0.85)) drop-shadow(0 0 20px rgba(0, 113, 227, 0.4))",
              }}
            />
          </div>

          {/* Pure Minimalist Typography */}
          <div className="text-center select-none">
            <div className="font-display font-black text-3xl md:text-4xl tracking-tight text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.8)]">
              FORGE<span className="text-amber-400 font-serif italic font-normal px-1">&amp;</span>FABRIC
            </div>
            <div className="text-[11px] font-bold uppercase tracking-[0.35em] text-neutral-300 mt-2 flex items-center justify-center gap-2">
              <span className="h-[1px] w-6 bg-amber-400/40 inline-block" />
              Industries, Inc.
              <span className="h-[1px] w-6 bg-amber-400/40 inline-block" />
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
};
