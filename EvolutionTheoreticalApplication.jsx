import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Dna, Shuffle, Code } from 'lucide-react';

// ============================================
// DNA-BPE ENCODER (Simplified)
// ============================================
class DNABPE {
  constructor() {
    this.bases = ['A', 'U', 'G', 'C'];
    this.codons = [];
    
    for (let b1 of this.bases) {
      for (let b2 of this.bases) {
        for (let b3 of this.bases) {
          this.codons.push(b1 + b2 + b3);
        }
      }
    }
    
    this.START = 'AUG';
    this.STOP_CODONS = ['UAA', 'UAG', 'UGA'];
  }
  
  encode(text) {
    const bytes = new TextEncoder().encode(text);
    const dna = [this.START];
    
    for (let i = 0; i < bytes.length; i += 3) {
      const b1 = bytes[i] || 0;
      const b2 = bytes[i + 1] || 0;
      const b3 = bytes[i + 2] || 0;
      
      const bits24 = (b1 << 16) | (b2 << 8) | b3;
      
      const c1 = (bits24 >> 18) & 0x3F;
      const c2 = (bits24 >> 12) & 0x3F;
      const c3 = (bits24 >> 6) & 0x3F;
      const c4 = bits24 & 0x3F;
      
      dna.push(this.codons[c1], this.codons[c2], this.codons[c3], this.codons[c4]);
    }
    
    dna.push(this.STOP_CODONS[0]);
    return dna;
  }
  
  decode(dna) {
    const startIdx = dna.indexOf(this.START);
    let endIdx = dna.length;
    
    for (let stopCodon of this.STOP_CODONS) {
      const idx = dna.indexOf(stopCodon);
      if (idx !== -1 && idx > startIdx) {
        endIdx = idx;
        break;
      }
    }
    
    const codingSequence = dna.slice(startIdx + 1, endIdx);
    
    const bytes = [];
    for (let i = 0; i < codingSequence.length; i += 4) {
      const c1 = this.codons.indexOf(codingSequence[i] || 'AAA');
      const c2 = this.codons.indexOf(codingSequence[i + 1] || 'AAA');
      const c3 = this.codons.indexOf(codingSequence[i + 2] || 'AAA');
      const c4 = this.codons.indexOf(codingSequence[i + 3] || 'AAA');
      
      const bits24 = (c1 << 18) | (c2 << 12) | (c3 << 6) | c4;
      
      const b1 = (bits24 >> 16) & 0xFF;
      const b2 = (bits24 >> 8) & 0xFF;
      const b3 = bits24 & 0xFF;
      
      bytes.push(b1, b2, b3);
    }
    
    try {
      return new TextDecoder().decode(new Uint8Array(bytes));
    } catch (e) {
      return "// Decoding error - non-viable organism";
    }
  }
}

const MAGNOQUILL_CODE = `
function creature(ctx, t, width, height) {
  const points = [];
  for (let i = 0; i < 8000; i++) {
    const x = i;
    const y = i / 235.0;
    
    const k = (4 + Math.sin(x/11 + 8*t)) * Math.cos(x/14);
    const e = y/8 - 19;
    const d = Math.sqrt(k*k + e*e) + Math.sin(y/9 + 2*t);
    const q = 2*Math.sin(2*k) + Math.sin(y/17)*k*(9 + 2*Math.sin(y - 3*d));
    const c = d*d/49 - t;
    
    const xp = q + 50*Math.cos(c) + 200;
    const yp = q*Math.sin(c) + d*39 - 440;
    
    points.push({x: xp, y: 400 - yp});
  }
  
  ctx.fillStyle = '#4ECDC4';
  points.forEach(p => {
    if (p.x >= 0 && p.x < width && p.y >= 0 && p.y < height) {
      ctx.fillRect(p.x, p.y, 1, 1);
    }
  });
}
`;

const MILLIPEDE_CODE = `
function creature(ctx, t, width, height) {
  const segments = 25;
  const centerX = width / 2;
  const centerY = height / 2;
  const bodyLength = 300;
  const segmentLength = bodyLength / segments;
  
  ctx.strokeStyle = '#FF6B6B';
  ctx.lineWidth = 6;
  
  for (let i = 0; i < segments; i++) {
    const y = centerY - bodyLength/2 + i * segmentLength;
    const wave = Math.sin(t * 2 + i * 0.3) * 60;
    const legLength = 40 + Math.sin(i * 0.5) * 20;
    
    // Left leg
    ctx.beginPath();
    ctx.moveTo(centerX, y);
    ctx.lineTo(centerX - legLength + wave, y + 15);
    ctx.stroke();
    
    // Right leg
    ctx.beginPath();
    ctx.moveTo(centerX, y);
    ctx.lineTo(centerX + legLength - wave, y + 15);
    ctx.stroke();
  }
  
  // Body spine
  ctx.strokeStyle = '#FF8888';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(centerX, centerY - bodyLength/2);
  ctx.lineTo(centerX, centerY + bodyLength/2);
  ctx.stroke();
}
`;

class CodeOrganism {
  constructor(code, id, generation, parentIds = []) {
    this.id = id;
    this.code = code;
    this.dna = new DNABPE().encode(code);
    this.generation = generation;
    this.parentIds = parentIds;
    this.fitness = 0;
    this.viable = true;
    this.error = null;
    this.color = this.generateColor();
  }

  generateColor() {
    const hash = this.id.toString().split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 60%)`;
  }

  evaluateFitness(canvas) {
    try {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const func = new Function('ctx', 't', 'width', 'height', this.code + '; creature(ctx, t, width, height);');
      
      const startTime = performance.now();
      func(ctx, 0, canvas.width, canvas.height);
      const execTime = performance.now() - startTime;
      
      let fitness = 100;
      
      if (execTime > 1 && execTime < 100) {
        fitness += Math.max(0, 50 - execTime);
      }
      
      fitness += Math.max(0, 100 - this.code.length / 10);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let pixelCount = 0;
      const sampleRate = 10; // Sample every 10th pixel
      for (let i = 0; i < imageData.data.length; i += 4 * sampleRate) {
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        const a = imageData.data[i + 3];
        if (r > 0 || g > 0 || b > 0 || a > 0) pixelCount++;
      }
      pixelCount *= sampleRate; // Scale back up
      if (pixelCount > 100) {
        fitness += Math.min(100, pixelCount / 100);
      }
      
      fitness += this.generation * 2;
      
      this.fitness = fitness;
      this.viable = true;
      this.error = null;
    } catch (e) {
      this.fitness = 0;
      this.viable = false;
      this.error = e.message;
    }
  }

  render(ctx, t) {
    if (!this.viable) return;
    try {
      ctx.save(); // Save canvas state
      const func = new Function('ctx', 't', 'width', 'height', this.code + '; creature(ctx, t, width, height);');
      func(ctx, t, ctx.canvas.width, ctx.canvas.height);
      ctx.restore(); // Restore canvas state
    } catch (e) {
      ctx.restore(); // Ensure restore even on error
    }
  }

  static crossover(parent1, parent2, nextId, generation) {
    const maxAttempts = 10;
    let attempts = 0;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      attempts++;
      const dna1 = parent1.dna.slice();
      const dna2 = parent2.dna.slice();

      const start1 = dna1.indexOf('AUG');
      const start2 = dna2.indexOf('AUG');
      const stopCodons = ['UAA', 'UAG', 'UGA'];

      let end1 = dna1.length - 1;
      let end2 = dna2.length - 1;

      for (let i = start1; i < dna1.length; i++) {
        if (stopCodons.includes(dna1[i])) {
          end1 = i;
          break;
        }
      }
      for (let i = start2; i < dna2.length; i++) {
        if (stopCodons.includes(dna2[i])) {
          end2 = i;
          break;
        }
      }

      const coding1 = dna1.slice(start1 + 1, end1);
      const coding2 = dna2.slice(start2 + 1, end2);

      let offspringDNA;
      if (attempt < 3) {
        const minLen = Math.min(coding1.length, coding2.length);
        const crossPoint = Math.floor(Math.random() * minLen);
        offspringDNA = [
          'AUG',
          ...coding1.slice(0, crossPoint),
          ...coding2.slice(crossPoint),
          'UAA'
        ];
      } else if (attempt < 6) {
        const favorParent1 = Math.random() > 0.5;
        const ratio = 0.7 + Math.random() * 0.2;
        const crossPoint = favorParent1 
          ? Math.floor(coding1.length * ratio)
          : Math.floor(coding2.length * (1 - ratio));
        offspringDNA = favorParent1 
          ? ['AUG', ...coding1.slice(0, crossPoint), ...coding2.slice(crossPoint), 'UAA']
          : ['AUG', ...coding2.slice(0, crossPoint), ...coding1.slice(crossPoint), 'UAA'];
      } else {
        const parent = Math.random() > 0.5 ? coding1 : coding2;
        offspringDNA = ['AUG', ...parent, 'UAA'];
      }

      const decoder = new DNABPE();
      const offspringCode = decoder.decode(offspringDNA);
      
      try {
        new Function('ctx', 't', 'width', 'height', offspringCode + '; creature(ctx, t, width, height);');
        
        const organism = new CodeOrganism(
          offspringCode,
          nextId,
          generation,
          [parent1.id, parent2.id]
        );
        organism._crossoverAttempts = attempts;
        return organism;
      } catch (e) {
        continue;
      }
    }
    
    const fitterParent = parent1.fitness >= parent2.fitness ? parent1 : parent2;
    const organism = new CodeOrganism(
      fitterParent.code,
      nextId,
      generation,
      [parent1.id, parent2.id]
    );
    organism._crossoverAttempts = attempts;
    organism._isClone = true;
    return organism;
  }

  mutate(mutationRate = 0.01) {
    const originalDNA = this.dna.slice();
    const originalCode = this.code;
    
    const dna = this.dna.slice();
    const bases = ['A', 'U', 'G', 'C'];
    
    this._mutationAttempted = true;

    for (let i = 1; i < dna.length - 1; i++) {
      if (Math.random() < mutationRate) {
        const codon = dna[i].split('');
        const baseIdx = Math.floor(Math.random() * 3);
        codon[baseIdx] = bases[Math.floor(Math.random() * bases.length)];
        dna[i] = codon.join('');
      }
    }

    const decoder = new DNABPE();
    const newCode = decoder.decode(dna);
    
    try {
      new Function('ctx', 't', 'width', 'height', newCode + '; creature(ctx, t, width, height);');
      this.code = newCode;
      this.dna = dna;
      this._mutationRejected = false;
    } catch (e) {
      this.code = originalCode;
      this.dna = originalDNA;
      this._mutationRejected = true;
    }
  }
}

export default function DNACodeEvolution() {
  const canvasRef = useRef(null);
  const hiddenCanvasRef = useRef(null);
  const nextIdRef = useRef(2);

  const [organisms, setOrganisms] = useState(() => [
    new CodeOrganism(MAGNOQUILL_CODE, 0, 0),
    new CodeOrganism(MILLIPEDE_CODE, 1, 0)
  ]);
  const [selectedOrganism, setSelectedOrganism] = useState(() => 
    new CodeOrganism(MAGNOQUILL_CODE, 0, 0)
  );
  const [generation, setGeneration] = useState(0);
  const [running, setRunning] = useState(false);
  const [time, setTime] = useState(0);
  const [viewMode, setViewMode] = useState('visual');
  const [evolutionStats, setEvolutionStats] = useState({
    crossoverAttempts: 0,
    crossoverSuccesses: 0,
    mutationAttempts: 0,
    mutationRejections: 0,
    stillbirthRate: 0
  });

  // Evaluate fitness on initial load
  useEffect(() => {
    const hiddenCanvas = hiddenCanvasRef.current;
    if (hiddenCanvas && organisms.length > 0) {
      organisms.forEach(org => org.evaluateFitness(hiddenCanvas));
      // Force re-render to show fitness values
      setOrganisms([...organisms]);
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || viewMode !== 'visual' || !selectedOrganism) return;

    const ctx = canvas.getContext('2d');
    let animationId;
    let localTime = time;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      selectedOrganism.render(ctx, localTime);
      localTime += 0.01;
      animationId = requestAnimationFrame(animate);
    };

    animate();
    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [selectedOrganism, viewMode, time]);

  useEffect(() => {
    const cycleInterval = setInterval(() => {
      setSelectedOrganism(prev => {
        const currentIdx = organisms.findIndex(o => o.id === prev.id);
        const nextIdx = (currentIdx + 1) % organisms.length;
        setTime(t => t + 10);
        return organisms[nextIdx];
      });
    }, 10000);
    
    return () => clearInterval(cycleInterval);
  }, [organisms]); // Only re-deps on pop changes

  const evolve = () => {
    const hiddenCanvas = hiddenCanvasRef.current;
    if (!hiddenCanvas || organisms.length === 0) return;

    organisms.forEach(org => org.evaluateFitness(hiddenCanvas));

    const viable = organisms.filter(org => org.viable);
    if (viable.length < 2) {
      alert('Not enough viable organisms to continue evolution! Resetting...');
      reset();
      return;
    }

    viable.sort((a, b) => b.fitness - a.fitness);
    
    // Keep top 50% as survivors, but ALWAYS keep the original parents (id 0 and 1) if they're viable
    let survivors = viable.slice(0, Math.max(2, Math.ceil(viable.length / 2)));
    
    // Ensure original creatures survive if viable
    const magnoquill = viable.find(o => o.id === 0);
    const millipede = viable.find(o => o.id === 1);
    if (magnoquill && !survivors.includes(magnoquill)) {
      survivors.push(magnoquill);
    }
    if (millipede && !survivors.includes(millipede)) {
      survivors.push(millipede);
    }

    const offspring = [];
    const newGen = generation + 1;
    
    // Track statistics
    let totalCrossoverAttempts = 0;
    let totalCrossoverSuccesses = 0;
    let totalMutationAttempts = 0;
    let totalMutationRejections = 0;

    for (let i = 0; i < survivors.length; i++) {
      const parent1 = survivors[i];
      const parent2 = survivors[(i + 1) % survivors.length];

      const child = CodeOrganism.crossover(
        parent1,
        parent2,
        nextIdRef.current++,
        newGen
      );
      
      // Collect crossover stats
      totalCrossoverAttempts += child._crossoverAttempts || 1;
      if (!child._isClone) totalCrossoverSuccesses++;

      if (Math.random() < 0.1) {
        child.mutate(0.01);
        if (child._mutationAttempted) totalMutationAttempts++;
        if (child._mutationRejected) totalMutationRejections++;
      }

      offspring.push(child);
    }

    const newPopulation = [...survivors, ...offspring];
    const viableCount = newPopulation.filter(org => org.viable).length;
    
    // Update statistics
    const stillbirthRate = totalCrossoverAttempts > 0 
      ? ((totalCrossoverAttempts - totalCrossoverSuccesses) / totalCrossoverAttempts * 100).toFixed(1)
      : 0;
    
    setEvolutionStats({
      crossoverAttempts: totalCrossoverAttempts,
      crossoverSuccesses: totalCrossoverSuccesses,
      mutationAttempts: totalMutationAttempts,
      mutationRejections: totalMutationRejections,
      stillbirthRate: stillbirthRate
    });
    
    if (viableCount >= 2) {
      setOrganisms(newPopulation);
      setGeneration(newGen);
      
      const viableOrgs = newPopulation.filter(org => org.viable).sort((a, b) => b.fitness - a.fitness);
      setSelectedOrganism(viableOrgs[0]);
      
      console.log(`Gen ${newGen}: ${viableOrgs.length} viable organisms, Stillbirth: ${stillbirthRate}%`);
      console.log(`  Magnoquill (#0): ${magnoquill ? 'ALIVE ✓' : 'DEAD ✗'}`);
      console.log(`  Millipede (#1): ${millipede ? 'ALIVE ✓' : 'DEAD ✗'}`);
    } else {
      console.warn('Generation failed - too few viable offspring, keeping previous generation');
    }
  };

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      evolve();
    }, 3000);
    return () => clearInterval(interval);
  }, [running, organisms, generation]); // Include deps for evolve closure

  const reset = () => {
    setRunning(false);
    setGeneration(0);
    setTime(0);
    nextIdRef.current = 2;
    setEvolutionStats({
      crossoverAttempts: 0,
      crossoverSuccesses: 0,
      mutationAttempts: 0,
      mutationRejections: 0,
      stillbirthRate: 0
    });
    const initialPopulation = [
      new CodeOrganism(MAGNOQUILL_CODE, 0, 0),
      new CodeOrganism(MILLIPEDE_CODE, 1, 0)
    ];
    
    const hiddenCanvas = hiddenCanvasRef.current;
    if (hiddenCanvas) {
      initialPopulation.forEach(org => org.evaluateFitness(hiddenCanvas));
    }
    
    setOrganisms(initialPopulation);
    setSelectedOrganism(initialPopulation[0]);
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6 bg-gray-900 rounded-xl shadow-2xl">
      <div className="mb-4">
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
          🧬 DNA-BPE Code Evolution: Breeding Generative Art
        </h1>
        <p className="text-gray-400">
          Watch programs breed and evolve through DNA-encoded crossover
        </p>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="col-span-2">
          <div className="mb-2 flex gap-2">
            <button
              onClick={() => setViewMode('visual')}
              className={`px-4 py-2 rounded ${viewMode === 'visual' ? 'bg-cyan-600' : 'bg-gray-700'} text-white text-sm`}
            >
              Visual
            </button>
            <button
              onClick={() => setViewMode('code')}
              className={`px-4 py-2 rounded ${viewMode === 'code' ? 'bg-cyan-600' : 'bg-gray-700'} text-white text-sm flex items-center gap-2`}
            >
              <Code size={16} />
              Source Code
            </button>
          </div>
          {viewMode === 'visual' ? (
            <canvas
              ref={canvasRef}
              width={800}
              height={600}
              className="w-full border-4 border-cyan-500 rounded-lg"
              style={{ background: '#0a0a0a' }}
            />
          ) : (
            <div className="w-full h-[600px] border-4 border-cyan-500 rounded-lg bg-gray-800 p-4 overflow-auto">
              <pre className="text-green-400 text-xs font-mono whitespace-pre-wrap">
                {selectedOrganism?.code || '// No organism selected'}
              </pre>
            </div>
          )}
          <canvas
            ref={hiddenCanvasRef}
            width={800}
            height={600}
            className="hidden"
          />
        </div>
        <div className="space-y-4">
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="font-bold text-cyan-400 mb-2">Selected Organism</h3>
            {selectedOrganism ? (
              <div className="text-sm space-y-1">
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ background: selectedOrganism.color }}
                  />
                  <span className="text-white">ID: {selectedOrganism.id}</span>
                </div>
                <div className="text-gray-300">Gen: {selectedOrganism.generation}</div>
                <div className="text-gray-300">
                  Fitness: {selectedOrganism.fitness.toFixed(1)}
                </div>
                <div className={selectedOrganism.viable ? 'text-green-400' : 'text-red-400'}>
                  {selectedOrganism.viable ? '✓ Viable' : '✗ Non-viable'}
                </div>
                {selectedOrganism.parentIds.length > 0 && (
                  <div className="text-gray-400 text-xs">
                    Parents: {selectedOrganism.parentIds.join(', ')}
                  </div>
                )}
                {selectedOrganism.error && (
                  <div className="text-red-400 text-xs mt-2">
                    Error: {selectedOrganism.error}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-gray-500 text-sm">No organism selected</div>
            )}
          </div>
          <div className="bg-gray-800 rounded-lg p-4 h-64 overflow-auto">
            <h3 className="font-bold text-purple-400 mb-2 flex items-center gap-2">
              <Dna size={16} />
              DNA Sequence
            </h3>
            {selectedOrganism ? (
              <div className="font-mono text-xs space-y-1">
                {selectedOrganism.dna.slice(0, 50).map((codon, i) => (
                  <span
                    key={i}
                    className={`inline-block px-1 mr-1 ${
                      codon === 'AUG' ? 'bg-green-900 text-green-300' :
                      ['UAA', 'UAG', 'UGA'].includes(codon) ? 'bg-red-900 text-red-300' :
                      'bg-blue-900 text-blue-300'
                    }`}
                  >
                    {codon}
                  </span>
                ))}
                {selectedOrganism.dna.length > 50 && (
                  <div className="text-gray-500 mt-2">
                    ... {selectedOrganism.dna.length - 50} more codons
                  </div>
                )}
              </div>
            ) : (
              <div className="text-gray-500 text-sm">No DNA to display</div>
            )}
          </div>
          <div className="bg-gray-800 rounded-lg p-4 h-48 overflow-auto">
            <h3 className="font-bold text-yellow-400 mb-2">
              Population (Gen {generation})
            </h3>
            <div className="space-y-1">
              {organisms
                .sort((a, b) => b.fitness - a.fitness)
                .map((org, i) => (
                  <div
                    key={org.id}
                    className={`flex items-center justify-between p-2 rounded cursor-pointer text-xs ${
                      selectedOrganism?.id === org.id
                        ? 'bg-cyan-900'
                        : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                    onClick={() => setSelectedOrganism(org)}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ background: org.color }}
                      />
                      <span className="text-white">#{org.id}</span>
                      {org.id === 0 && <span title="Magnoquill">🌊</span>}
                      {org.id === 1 && <span title="Millipede">🦗</span>}
                      {i === 0 && <span>👑</span>}
                      {!org.viable && <span className="text-red-400">💀</span>}
                    </div>
                    <span className="text-gray-400">{org.fitness.toFixed(0)}</span>
                  </div>
                ))}
            </div>
          </div>
          
          {/* Evolution Statistics */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="font-bold text-orange-400 mb-2">⚗️ Conception Stats</h3>
            {generation > 0 ? (
              <div className="text-xs space-y-1">
                <div className="flex justify-between text-gray-300">
                  <span>Crossover attempts:</span>
                  <span className="text-white font-mono">{evolutionStats.crossoverAttempts}</span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>Viable offspring:</span>
                  <span className="text-green-400 font-mono">{evolutionStats.crossoverSuccesses}</span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>Stillbirth rate:</span>
                  <span className="text-red-400 font-mono font-bold">{evolutionStats.stillbirthRate}%</span>
                </div>
                <div className="flex justify-between text-gray-300 pt-2 border-t border-gray-700">
                  <span>Mutations attempted:</span>
                  <span className="text-white font-mono">{evolutionStats.mutationAttempts}</span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>Mutations rejected:</span>
                  <span className="text-yellow-400 font-mono">{evolutionStats.mutationRejections}</span>
                </div>
                <div className="text-gray-500 text-xs pt-2 border-t border-gray-700">
                  Selection bias at conception: filtering invalid syntax before birth
                </div>
              </div>
            ) : (
              <div className="text-gray-500 text-xs">
                Run evolution to see conception statistics
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex gap-3 mb-4">
        <button
          onClick={() => setRunning(!running)}
          className={`flex-1 py-3 px-6 rounded-lg font-semibold flex items-center justify-center gap-2 ${
            running ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
          } text-white`}
        >
          {running ? <Pause size={20} /> : <Play size={20} />}
          {running ? 'Pause Evolution' : 'Start Evolution'}
        </button>
        <button
          onClick={evolve}
          disabled={running}
          className="py-3 px-6 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 text-white rounded-lg font-semibold flex items-center gap-2"
        >
          <Shuffle size={20} />
          Evolve Once
        </button>
        <button
          onClick={reset}
          className="py-3 px-6 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold flex items-center gap-2"
        >
          <RotateCcw size={20} />
          Reset
        </button>
      </div>
      <div className="flex gap-3 mb-4">
        <button
          onClick={() => setSelectedOrganism(organisms.find(o => o.id === 0) || organisms[0])}
          className="flex-1 py-2 px-4 bg-cyan-700 hover:bg-cyan-600 text-white rounded-lg text-sm"
        >
          View Magnoquill (#0)
        </button>
        <button
          onClick={() => setSelectedOrganism(organisms.find(o => o.id === 1) || organisms[1])}
          className="flex-1 py-2 px-4 bg-red-700 hover:bg-red-600 text-white rounded-lg text-sm"
        >
          View Millipede (#1)
        </button>
      </div>
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="font-bold text-white mb-2">🧬 How It Works:</h3>
        <div className="grid grid-cols-2 gap-4 text-sm text-gray-300">
          <div className="space-y-1">
            <div><strong className="text-cyan-400">Encode:</strong> Programs → DNA codons</div>
            <div><strong className="text-green-400">Crossover:</strong> Mix DNA with validation</div>
            <div><strong className="text-purple-400">Mutate:</strong> 1% chance per codon (safe)</div>
          </div>
          <div className="space-y-1">
            <div><strong className="text-yellow-400">Decode:</strong> DNA → New program code</div>
            <div><strong className="text-orange-400">Execute:</strong> Run and measure fitness</div>
            <div><strong className="text-pink-400">Select:</strong> Best organisms survive</div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-700 text-sm text-gray-300">
          <strong>Starting Creatures:</strong> Magnoquill 🌊 (flowing particles) × Millipede 🦗 (animated legs) → Hybrid offspring!
        </div>
        <div className="mt-2 pt-2 border-t border-gray-700 text-xs text-yellow-400">
          <strong>🔬 Pragmatic Evolution:</strong> Crossover validates offspring syntax (10 retry attempts). Mutations validate before applying (1% per codon). Original parents always survive if viable. Check <strong>⚗️ Conception Stats</strong> to see "selection bias at conception" - the stillbirth rate shows what % of genetic combinations were rejected!
        </div>
      </div>
    </div>
  );
}
