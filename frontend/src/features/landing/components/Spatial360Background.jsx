import React, { useEffect, useRef } from 'react';

export default function Spatial360Background() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    let rotationY = 0;
    let rotationX = 0.2;
    let mouseX = 0;
    let mouseY = 0;

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    const handleMouseMove = (e) => {
      mouseX = (e.clientX / width - 0.5) * 0.4;
      mouseY = (e.clientY / height - 0.5) * 0.4;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);

    // Create 360° spatial nodes
    const nodeCount = 36;
    const sphereRadius = Math.min(width, height) * 0.38;
    const nodes = [];

    for (let i = 0; i < nodeCount; i++) {
      const phi = Math.acos(-1 + (2 * i) / nodeCount);
      const theta = Math.sqrt(nodeCount * Math.PI) * phi;
      nodes.push({
        x: sphereRadius * Math.cos(theta) * Math.sin(phi),
        y: sphereRadius * Math.sin(theta) * Math.sin(phi),
        z: sphereRadius * Math.cos(phi),
        size: Math.random() * 2.2 + 1.2,
        pulse: Math.random() * Math.PI * 2
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2 + 10;

      // Smooth camera sway towards mouse
      rotationY += 0.003 + (mouseX - rotationY) * 0.02;
      rotationX += (mouseY - rotationX) * 0.02;

      const cosY = Math.cos(rotationY);
      const sinY = Math.sin(rotationY);
      const cosX = Math.cos(rotationX);
      const sinX = Math.sin(rotationX);

      // Draw 360° Equirectangular Latitude Rings
      ctx.lineWidth = 1;
      const latRings = 5;
      for (let r = 1; r <= latRings; r++) {
        const ringRad = (sphereRadius * r) / latRings;
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(207, 168, 67, 0.06)';
        ctx.ellipse(centerX, centerY, ringRad, ringRad * 0.35, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw 360° Longitude Sector Lines
      const longSectors = 8;
      for (let s = 0; s < longSectors; s++) {
        const angle = (s * Math.PI) / longSectors + rotationY;
        const rx = Math.cos(angle) * sphereRadius;
        const ry = Math.sin(angle) * sphereRadius * 0.35;

        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.moveTo(centerX - rx, centerY - ry);
        ctx.lineTo(centerX + rx, centerY + ry);
        ctx.stroke();
      }

      // Project & Draw 3D Spatial Nodes
      const projectedNodes = [];

      nodes.forEach((node) => {
        node.pulse += 0.03;

        // 3D Y-axis rotation
        let x1 = node.x * cosY - node.z * sinY;
        let z1 = node.z * cosY + node.x * sinY;

        // 3D X-axis rotation
        let y2 = node.y * cosX - z1 * sinX;
        let z2 = z1 * cosX + node.y * sinX;

        // Perspective scale factor
        const fov = 600;
        const scale = fov / (fov + z2);
        const projX = centerX + x1 * scale;
        const projY = centerY + y2 * scale;

        const alpha = Math.max(0.1, (z2 + sphereRadius) / (sphereRadius * 2));

        projectedNodes.push({
          x: projX,
          y: projY,
          scale,
          alpha,
          pulse: node.pulse,
          size: node.size
        });
      });

      // Draw connecting spatial links between near nodes
      ctx.lineWidth = 0.8;
      for (let i = 0; i < projectedNodes.length; i++) {
        for (let j = i + 1; j < projectedNodes.length; j++) {
          const p1 = projectedNodes[i];
          const p2 = projectedNodes[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 130) {
            const lineAlpha = (1 - dist / 130) * 0.12 * Math.min(p1.alpha, p2.alpha);
            ctx.strokeStyle = `rgba(207, 168, 67, ${lineAlpha})`;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }

      // Render 360° Hotspot Nodes
      projectedNodes.forEach((p) => {
        const pulseScale = 1 + Math.sin(p.pulse) * 0.25;
        const r = p.size * p.scale * pulseScale;

        // Glow ring
        ctx.beginPath();
        ctx.fillStyle = `rgba(207, 168, 67, ${p.alpha * 0.8})`;
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.strokeStyle = `rgba(255, 255, 255, ${p.alpha * 0.4})`;
        ctx.arc(p.x, p.y, r * 2.2, 0, Math.PI * 2);
        ctx.stroke();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1
      }}
    />
  );
}
