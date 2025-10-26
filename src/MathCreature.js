export default class MathCreature {
  constructor({ genome = null, id = 0, generation = 0, parentIds = [] } = {}) {
    this.id = id;
    this.generation = generation;
    this.parentIds = parentIds;
    this.age = 0;
    this.fitness = 0;
    this.viable = true;
    this.error = null;
    this.color = this.generateColor();
    this.genome = Array.isArray(genome) ? genome.slice(0, 16) : [
      4, 11, 14, 8, 19, 9, 2, 2, 17, 9, 2, 49, 50, 200, 39, -440
    ];
  }

  generateColor() {
    const hash = Math.abs(this.id * 2654435761 >>> 0) % 360;
    return `hsl(${hash},70%,60%)`;
  }

  generatePoints(t, numPoints = 8000) {
    const pts = new Array(numPoints);
    const g = this.genome;
    for (let i = 0; i < numPoints; i++) {
      const x = i;
      const y = i / 235.0;

      const k = (g[0] + Math.sin(x / g[1] + 8 * t)) * Math.cos(x / g[2]);
      const e = y / g[3] - g[4];
      const d = Math.sqrt(k * k + e * e) + Math.sin(y / g[5] + g[6] * t);
      const q = g[7] * Math.sin(2 * k) + Math.sin(y / g[8]) * k * (g[9] + g[10] * Math.sin(y - 3 * d));
      const c = d * d / g[11] - t;

      const xp = q + g[12] * Math.cos(c) + g[13];
      const yp = q * Math.sin(c) + g[14] * d + g[15];

      pts[i] = { x: xp, y: 400 - yp };
    }
    return pts;
  }

  calculateFitness(ctx, t = 0) {
    try {
      const canvas = ctx.canvas;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const pts = this.generatePoints(t, 8000);
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (p.x >= 0 && p.x < canvas.width && p.y >= 0 && p.y < canvas.height) {
          ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
        }
      }

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const w = canvas.width, h = canvas.height;

      let nonEmpty = 0;
      const sampleRate = 10;
      for (let i = 0; i < data.length; i += 4 * sampleRate) {
        if (data[i] !== 0 || data[i + 1] !== 0 || data[i + 2] !== 0 || data[i + 3] !== 0) nonEmpty++;
      }
      nonEmpty *= sampleRate;
      const coverageScore = Math.min(100, (nonEmpty / (w * h)) * 1000);

      let smoothCount = 0;
      const Nsample = 1000;
      for (let i = 0; i < Nsample - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (dist < 50) smoothCount++;
      }
      const smoothnessScore = (smoothCount / (Nsample - 1)) * 50;

      const bucketW = 20, bucketH = 20;
      const buckets = new Set();
      for (let i = 0; i < pts.length; i++) {
        const px = Math.floor(pts[i].x / bucketW);
        const py = Math.floor(pts[i].y / bucketH);
        buckets.add(`${px},${py}`);
      }
      const complexityScore = Math.min(100, buckets.size * 0.5);

      const longevityScore = this.age * 0.1;

      const total = (coverageScore * 0.5) + smoothnessScore + complexityScore + longevityScore;
      this.fitness = total;
      this.viable = true;
      this.error = null;
      return this.fitness;
    } catch (e) {
      this.fitness = 0;
      this.viable = false;
      this.error = e.message;
      return 0;
    }
  }

  static crossover(parentA, parentB, childId, generation) {
    const pA = parentA.genome;
    const pB = parentB.genome;
    const cp = Math.floor(Math.random() * pA.length);
    const childGenome = pA.slice(0, cp).concat(pB.slice(cp));
    const child = new MathCreature({ genome: childGenome, id: childId, generation, parentIds: [parentA.id, parentB.id] });
    return child;
  }

  mutate({ sigma = 0.5, largeProb = 0.02 } = {}) {
    for (let i = 0; i < this.genome.length; i++) {
      if (Math.random() < largeProb) {
        this.genome[i] = (Math.random() * 20) - 10;
      } else if (Math.random() < 0.2) {
        const noise = (randn_bm() * sigma);
        this.genome[i] += noise;
      }
    }
  }

  duplicateSegment() {
    const len = Math.max(1, Math.floor(Math.random() * 4));
    const start = Math.floor(Math.random() * (this.genome.length - len));
    const seg = this.genome.slice(start, start + len);
    this.genome.splice(start + len, 0, ...seg);
    this.genome = this.genome.slice(0, 16);
  }

  invertSegment() {
    const len = Math.max(1, Math.floor(Math.random() * 4));
    const start = Math.floor(Math.random() * (this.genome.length - len));
    const seg = this.genome.slice(start, start + len).reverse();
    for (let i = 0; i < len; i++) this.genome[start + i] = seg[i];
  }
}

function randn_bm() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}