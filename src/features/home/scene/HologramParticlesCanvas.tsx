import { useEffect, useRef } from "react";
import { performanceModeParticleCounts } from "./homeSceneConstants";
import type { HomePerformanceMode } from "../../../types/domain";

interface Particle {
  x: number;
  y: number;
  z: number;
  speed: number;
  radius: number;
  alpha: number;
  hue: number;
  drift: number;
}

function makeParticle(width: number, height: number, index: number): Particle {
  const beamBias = index % 3 === 0;
  return {
    x: beamBias
      ? width * (0.5 + (Math.random() - 0.5) * 0.18)
      : Math.random() * width,
    y: Math.random() * height,
    z: Math.random(),
    speed: beamBias ? 0.35 + Math.random() * 0.9 : 0.05 + Math.random() * 0.28,
    radius: beamBias ? 0.8 + Math.random() * 1.5 : 0.45 + Math.random() * 1.2,
    alpha: beamBias ? 0.45 + Math.random() * 0.42 : 0.12 + Math.random() * 0.36,
    hue: beamBias ? 190 + Math.random() * 34 : 222 + Math.random() * 70,
    drift: (Math.random() - 0.5) * 0.26,
  };
}

export function HologramParticlesCanvas({
  reducedMotion,
  performanceMode,
  visible,
}: {
  reducedMotion: boolean;
  performanceMode: HomePerformanceMode;
  visible: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const canvasElement = canvas;
    const context2d = context;
    let frame = 0;
    let width = 0;
    let height = 0;
    let lastDrawTime = 0;
    const particleTarget = reducedMotion
      ? 14
      : performanceModeParticleCounts[performanceMode];
    const frameInterval = reducedMotion
      ? 1000
      : performanceMode === "full"
        ? 34
        : performanceMode === "balanced"
          ? 140
          : 260;

    function resize() {
      const rect = canvasElement.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      canvasElement.width = Math.floor(width * pixelRatio);
      canvasElement.height = Math.floor(height * pixelRatio);
      context2d.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      particlesRef.current = Array.from({ length: particleTarget }, (_, index) =>
        makeParticle(width, height, index),
      );
    }

    function draw(now: number) {
      if (now - lastDrawTime < frameInterval) {
        frame = window.requestAnimationFrame(draw);
        return;
      }

      lastDrawTime = now;
      context2d.clearRect(0, 0, width, height);

      if (!visible) {
        frame = window.requestAnimationFrame(draw);
        return;
      }

      context2d.globalCompositeOperation = "lighter";
      const particles = particlesRef.current;
      particles.forEach((particle, index) => {
        const depth = 0.45 + particle.z * 0.9;
        const radius = particle.radius * depth;
        const alpha = reducedMotion ? particle.alpha * 0.42 : particle.alpha;
        const glow = context2d.createRadialGradient(
          particle.x,
          particle.y,
          0,
          particle.x,
          particle.y,
          radius * 5,
        );
        glow.addColorStop(0, `hsla(${particle.hue}, 100%, 72%, ${alpha})`);
        glow.addColorStop(1, `hsla(${particle.hue}, 100%, 52%, 0)`);
        context2d.fillStyle = glow;
        context2d.beginPath();
        context2d.arc(particle.x, particle.y, radius * 5, 0, Math.PI * 2);
        context2d.fill();

        if (!reducedMotion) {
          particle.y += particle.speed * depth;
          particle.x +=
            particle.drift + Math.sin((particle.y + index) * 0.015) * 0.12;

          if (
            particle.y > height + 24 ||
            particle.x < -24 ||
            particle.x > width + 24
          ) {
            particles[index] = makeParticle(width, height, index);
            particles[index].y = -12;
          }
        }
      });

      context2d.globalCompositeOperation = "source-over";
      frame = window.requestAnimationFrame(draw);
    }

    resize();
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    resizeObserver?.observe(canvasElement);
    window.addEventListener("resize", resize, { passive: true });
    frame = window.requestAnimationFrame(draw);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", resize);
      window.cancelAnimationFrame(frame);
    };
  }, [performanceMode, reducedMotion, visible]);

  return (
    <canvas
      aria-hidden="true"
      className="hologram-particles"
      ref={canvasRef}
    />
  );
}
