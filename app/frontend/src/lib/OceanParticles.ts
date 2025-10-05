import mapboxgl from 'mapbox-gl';
import type { WindData } from './windyApi';

interface Particle {
  x: number;
  y: number;
  age: number;
  maxAge: number;
  speed: number;
}

interface Bounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export class OceanParticles {
  private particles: Particle[] = [];
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private currentField: WindData[] = [];
  private bounds: Bounds;
  private map: mapboxgl.Map | null = null;
  private waterMask: Set<string> = new Set();

  constructor(
    width: number,
    height: number,
    bounds: Bounds,
    particleCount: number = 5000
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d')!;
    this.bounds = bounds;

    // Initialize particles
    for (let i = 0; i < particleCount; i++) {
      this.particles.push(this.createParticle());
    }
  }

  setMap(mapInstance: mapboxgl.Map) {
    this.map = mapInstance;
    this.updateWaterMask();
  }

  setCurrentField(currentData: WindData[]) {
    this.currentField = currentData;
    console.log('Current field set with', currentData.length, 'data points');
  }

  update() {
    // Subtle fade effect for smooth trails
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.particles.forEach((p) => this.updateParticle(p));
  }

  getCanvas() {
    return this.canvas;
  }

  resize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;

    if (this.map) {
      this.updateWaterMask();
    }
  }

  destroy() {
    this.waterMask.clear();
    this.particles = [];
  }

  private updateWaterMask() {
    if (!this.map) return;

    this.waterMask.clear();
    const gridSize = 20;

    for (let x = 0; x < this.canvas.width; x += gridSize) {
      for (let y = 0; y < this.canvas.height; y += gridSize) {
        const point = new mapboxgl.Point(x, y);
        const features = this.map.queryRenderedFeatures(point, {
          layers: ['water', 'waterway']
        });

        if (features.length > 0) {
          const key = `${Math.floor(x / gridSize)},${Math.floor(y / gridSize)}`;
          this.waterMask.add(key);
        }
      }
    }

    console.log('Water mask updated:', this.waterMask.size, 'water cells');
  }

  private isOverWater(x: number, y: number): boolean {
    const gridSize = 20;
    const key = `${Math.floor(x / gridSize)},${Math.floor(y / gridSize)}`;
    return this.waterMask.has(key);
  }

  private createParticle(): Particle {
    let attempts = 0;

    while (attempts < 50) {
      const x = Math.random() * this.canvas.width;
      const y = Math.random() * this.canvas.height;

      if (this.waterMask.size === 0 || this.isOverWater(x, y)) {
        return {
          x,
          y,
          age: Math.floor(Math.random() * 100),
          maxAge: 100 + Math.random() * 100,
          speed: 1
        };
      }
      attempts++;
    }

    // Fallback
    return {
      x: Math.random() * this.canvas.width,
      y: Math.random() * this.canvas.height,
      age: Math.floor(Math.random() * 100),
      maxAge: 100 + Math.random() * 100,
      speed: 1
    };
  }

  private updateParticle(p: Particle) {
    // Skip particles over land
    if (this.waterMask.size > 0 && !this.isOverWater(p.x, p.y)) {
      Object.assign(p, this.createParticle());
      return;
    }

    const prevX = p.x;
    const prevY = p.y;
    const current = this.getCurrentAtPosition(p.x, p.y);

    // Update position based on current field
    const speedFactor = 5.0;
    p.x += current.u * speedFactor;
    p.y -= current.v * speedFactor;
    p.age++;

    // Reset if moved onto land or out of bounds
    if (this.shouldResetParticle(p)) {
      Object.assign(p, this.createParticle());
      return;
    }

    this.drawParticle(p, prevX, prevY, current);
  }

  private shouldResetParticle(p: Particle): boolean {
    if (this.waterMask.size > 0 && !this.isOverWater(p.x, p.y)) return true;
    if (p.x < 0 || p.x > this.canvas.width || p.y < 0 || p.y > this.canvas.height) return true;
    if (p.age > p.maxAge) return true;
    return false;
  }

  private drawParticle(p: Particle, prevX: number, prevY: number, current: { u: number; v: number }) {
    const opacity = Math.max(0, 1 - p.age / p.maxAge) * 0.8;
    const speed = Math.sqrt(current.u * current.u + current.v * current.v);
    const color = this.getColorForSpeed(speed, opacity);

    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 1.5;
    this.ctx.lineCap = 'round';
    this.ctx.beginPath();
    this.ctx.moveTo(prevX, prevY);
    this.ctx.lineTo(p.x, p.y);
    this.ctx.stroke();
  }

  private getColorForSpeed(speed: number, opacity: number): string {
    if (speed < 0.1) return `rgba(150, 220, 255, ${opacity})`;
    if (speed < 0.3) return `rgba(100, 200, 255, ${opacity})`;
    if (speed < 0.6) return `rgba(100, 255, 220, ${opacity})`;
    if (speed < 1.0) return `rgba(100, 255, 150, ${opacity})`;
    if (speed < 1.5) return `rgba(255, 255, 100, ${opacity})`;
    return `rgba(255, 150, 100, ${opacity})`;
  }

  private getCurrentAtPosition(x: number, y: number): { u: number; v: number } {
    if (this.waterMask.size > 0 && !this.isOverWater(x, y)) {
      return { u: 0, v: 0 };
    }

    const lon = this.bounds.minLon + (x / this.canvas.width) * (this.bounds.maxLon - this.bounds.minLon);
    const lat = this.bounds.maxLat - (y / this.canvas.height) * (this.bounds.maxLat - this.bounds.minLat);

    if (this.currentField.length === 0) {
      return { u: 0, v: 0 };
    }

    // Find nearest ocean current data point
    let nearest = this.currentField[0];
    let minDist = Infinity;

    for (const point of this.currentField) {
      const dist = Math.sqrt(
        Math.pow(point.lat - lat, 2) + Math.pow(point.lon - lon, 2)
      );
      if (dist < minDist) {
        minDist = dist;
        nearest = point;
      }
    }

    return { u: nearest.u, v: nearest.v };
  }
}
