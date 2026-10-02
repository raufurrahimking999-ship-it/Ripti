import React, { useEffect, useRef } from 'react';

interface LoveParticle {
  x: number;
  y: number;
  scale: number;
  speedY: number;
  speedX: number;
  swayFreq: number;
  swayPhase: number;
  maxOpacity: number;
  hue: number; // 225 (soft blue) to 265 (gentle lavender / violet)
}

interface StarParticle {
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  opacity: number;
  hue: number;
  phase: number;
}

export const BackgroundAura: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let isRunning = true;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // =========================================================================
    // SOFT LOVE-SHAPED PARTICLES (12-14 particles at a time)
    // Small, delicate, dreamy silhouettes floating upward with soft lavender/blue/rose blur
    // =========================================================================
    const loveParticleCount = 13;
    const loveParticles: LoveParticle[] = Array.from({ length: loveParticleCount }, (_, idx) => {
      // Soft blues, periwinkle, lavender, midnight violet with subtle soft rose accents (338, 345)
      const hues = [225, 235, 248, 260, 268, 338, 345];
      return {
        x: Math.random() * width,
        // Stagger initial Y across screen height so they don't bunch up
        y: (height / loveParticleCount) * idx + Math.random() * 40,
        scale: Math.random() * 5 + 7, // 7px to 12px small silhouette
        speedY: Math.random() * 0.28 + 0.18, // very slow upward movement
        speedX: (Math.random() - 0.5) * 0.1,
        swayFreq: Math.random() * 0.015 + 0.008,
        swayPhase: Math.random() * Math.PI * 2,
        maxOpacity: Math.random() * 0.08 + 0.07, // 0.07 - 0.15 (very low opacity, non-distracting)
        hue: hues[Math.floor(Math.random() * hues.length)],
      };
    });

    // Ambient micro-starlight dust (18 subtle points)
    const starCount = 18;
    const starParticles: StarParticle[] = Array.from({ length: starCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 1.4 + 0.6,
      speedY: Math.random() * 0.2 + 0.06,
      speedX: (Math.random() - 0.5) * 0.12,
      opacity: Math.random() * 0.35 + 0.15,
      hue: Math.random() > 0.4 ? 230 : 255,
      phase: Math.random() * Math.PI * 2,
    }));

    // Draw soft heart silhouette
    const drawSoftHeart = (
      x: number,
      y: number,
      scale: number,
      opacity: number,
      hue: number
    ) => {
      if (opacity <= 0.005) return;

      ctx.save();
      // Soft ambient glow
      ctx.shadowBlur = scale * 1.2;
      ctx.shadowColor = `hsla(${hue}, 75%, 78%, ${opacity * 0.9})`;
      ctx.fillStyle = `hsla(${hue}, 70%, 82%, ${opacity})`;

      ctx.beginPath();
      // Mathematical smooth heart curve
      const cleftY = y - scale * 0.32;
      const bottomY = y + scale * 0.88;

      ctx.moveTo(x, cleftY);
      // Left lobe
      ctx.bezierCurveTo(
        x - scale * 0.55,
        y - scale * 0.92,
        x - scale * 1.08,
        y - scale * 0.08,
        x,
        bottomY
      );
      // Right lobe
      ctx.bezierCurveTo(
        x + scale * 1.08,
        y - scale * 0.08,
        x + scale * 0.55,
        y - scale * 0.92,
        x,
        cleftY
      );
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    let tick = 0;
    const render = () => {
      if (!isRunning) return;

      tick += 1;
      ctx.clearRect(0, 0, width, height);

      // 1. Render and update soft love particles (floating upward)
      for (let i = 0; i < loveParticles.length; i++) {
        const p = loveParticles[i];

        // Move upward
        p.y -= p.speedY;
        p.x += Math.sin(tick * p.swayFreq + p.swayPhase) * 0.28 + p.speedX;

        // Wrap around bottom smoothly
        if (p.y < -30) {
          p.y = height + 30;
          p.x = Math.random() * width;
          p.swayPhase = Math.random() * Math.PI * 2;
        }
        if (p.x < -30) p.x = width + 30;
        if (p.x > width + 30) p.x = -30;

        // Gentle fade-in as it rises from bottom, fade-out near top
        let opacityFactor = 1.0;
        if (p.y > height * 0.75) {
          // Fading in from bottom
          opacityFactor = Math.max(0, (height + 20 - p.y) / (height * 0.25));
        } else if (p.y < height * 0.3) {
          // Fading out towards top
          opacityFactor = Math.max(0, (p.y + 20) / (height * 0.3));
        }

        const currentOpacity = p.maxOpacity * opacityFactor;
        drawSoftHeart(p.x, p.y, p.scale, currentOpacity, p.hue);
      }

      // 2. Render subtle midnight starlight particles
      for (let i = 0; i < starParticles.length; i++) {
        const s = starParticles[i];
        s.y -= s.speedY;
        s.x += Math.sin(tick * 0.015 + s.phase) * 0.15 + s.speedX;

        if (s.y < -10) {
          s.y = height + 10;
          s.x = Math.random() * width;
        }
        if (s.x < -10) s.x = width + 10;
        if (s.x > width + 10) s.x = -10;

        const starOpacity = s.opacity * (0.7 + 0.3 * Math.sin(tick * 0.03 + s.phase));

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${s.hue}, 80%, 85%, ${starOpacity})`;
        ctx.shadowBlur = 5;
        ctx.shadowColor = `hsla(${s.hue}, 90%, 75%, ${starOpacity})`;
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    // Battery Optimization: pause animation when page or app is hidden / backgrounded
    const handleVisibilityChange = () => {
      if (document.hidden) {
        isRunning = false;
        cancelAnimationFrame(animationFrameId);
      } else {
        if (!isRunning) {
          isRunning = true;
          animationFrameId = requestAnimationFrame(render);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isRunning = false;
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="fixed inset-0 w-screen h-screen min-h-[100dvh] pointer-events-none overflow-hidden z-0 bg-[#040711]">
      {/* Deep Navy & Midnight Base Gradient */}
      <div 
        className="absolute inset-0 w-full h-full bg-gradient-to-b from-[#060b19] via-[#040712] to-[#02040a]" 
      />

      {/* Dynamic Full-Screen Ambient Light Glow Journeys (Whole Viewport Coverage) */}
      {/* 1. Deep Midnight / Indigo Glow (Traverses Top-Left -> Mid-Right -> Lower-Center -> Lower-Left) */}
      <div 
        className="absolute -top-[10%] -left-[10%] w-[420px] h-[420px] sm:w-[540px] sm:h-[540px] rounded-full bg-indigo-500 blur-[140px] sm:blur-[180px] animate-glow-journey-1" 
      />
      {/* 2. Lavender & Violet Glow (Traverses Mid-Right -> Bottom-Left -> Center-Top -> Top-Right) */}
      <div 
        className="absolute top-[40%] -right-[15%] w-[400px] h-[400px] sm:w-[500px] sm:h-[500px] rounded-full bg-violet-500 blur-[140px] sm:blur-[180px] animate-glow-journey-2" 
      />
      {/* 3. Deep Celestial Ocean Blue Glow (Traverses Lower-Left -> Center-Left -> Upper-Right -> Lower-Right) */}
      <div 
        className="absolute bottom-[5%] left-[5%] w-[380px] h-[380px] sm:w-[480px] sm:h-[480px] rounded-full bg-blue-600 blur-[130px] sm:blur-[170px] animate-glow-journey-3" 
      />
      {/* 4. Subtle Romantic Rose-Lavender Glow (Traverses Center-Right -> Heart Center -> Bottom-Center -> Upper-Center) */}
      <div 
        className="absolute top-[25%] right-[20%] w-[340px] h-[340px] sm:w-[440px] sm:h-[440px] rounded-full bg-rose-950 blur-[140px] sm:blur-[180px] animate-glow-journey-4" 
      />

      {/* Love particles & starlight canvas (Behind all UI cards) */}
      <canvas ref={canvasRef} className="absolute inset-0 block w-full h-full" />

      {/* Soft Vignette Overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(2,4,10,0.65)_100%)] pointer-events-none" />
    </div>
  );
};
