import React, { useEffect, useRef, useState } from "react";

// Flappy Bird — React + Canvas (single-file)
// 2:1 aspect, guaranteed-passable pipes, Easy/Normal/Hard modes,
// auto-restart on mode change, retro font HUD, layered clouds,
// and WebAudio sound effects (flap/score/game over).

export default function App() {
  // Inject retro font once
  useEffect(() => {
    const id = 'Press Start 2P';
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap';
      document.head.appendChild(link);
    }
    // Inject Tailwind CSS
    const tailwindId = 'tailwind-css';
    if (!document.getElementById(tailwindId)) {
        const script = document.createElement('script');
        script.id = tailwindId;
        script.src = "https://cdn.tailwindcss.com";
        document.head.appendChild(script);
    }
  }, []);

  // Canvas & RAF
  const canvasRef = useRef(null);
  const rafRef = useRef(0);

  // Display size (CSS pixels) — keeps 2:1 ratio
  const [displaySize, setDisplaySize] = useState({ w: 960, h: 480 });

  // UI state
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [mode, setMode] = useState('normal'); // 'easy' | 'normal' | 'hard'
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0); // used by the canvas draw loop
  const [best, setBest] = useState(() => {
    if (typeof window !== 'undefined') {
      return Number(localStorage.getItem('flappy_best') || 0);
    }
    return 0;
  });

  // World/gameplay refs (mutated inside the loop)
  const birdRef = useRef({ x: 160, y: 240, vy: 0, r: 16, wingAngle: 0 });
  const pipesRef = useRef([]); // { x, topH }
  const gameOverRef = useRef(false);
  const scoredSetRef = useRef(new Set());

  // Tunables derived from size
  const worldRef = useRef({
    t: 0,
    gravity: 0.5,
    flap: -9,
    pipeGap: 140,
    pipeWidth: 70,
    pipeSpacing: 300,
    speed: 3,
    groundY: 440,
    skyColor: '#87CEEB',
  });

  // === Size & scaling ===
  const ASPECT = 2; // width : height
  function recomputeSize() {
    // Reduced the minimum width to 400px for better responsiveness on smaller screens.
    const vw = Math.max(400, Math.min(1440, typeof window !== 'undefined' ? window.innerWidth - 32 : 960));
    const w = Math.round(vw);
    const h = Math.round(w / ASPECT);
    setDisplaySize({ w, h });
  }

  // Recompute on mount & resize
  useEffect(() => {
    recomputeSize();
    const onR = () => recomputeSize();
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, []);

  // Apply canvas backing resolution and scale-dependent physics when size OR mode changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { w: W, h: H } = displaySize;
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Scale gameplay
    const s = H / 480; // baseline at 480px height
    const world = worldRef.current;
    const baseGap = Math.max(120 * s, Math.round(H * 0.28));
    const gapFactor = mode === 'easy' ? 1.35 : mode === 'hard' ? 0.85 : 1.0; // EASY bigger, HARD smaller
    world.gravity = 0.5 * s;
    world.flap = -9 * s;
    world.pipeGap = Math.round(baseGap * gapFactor);
    world.pipeWidth = Math.max(54, Math.round(W * 0.06));
    world.pipeSpacing = Math.max(260, Math.round(W * 0.32));
    world.speed = (mode === 'easy' ? 2.4 : mode === 'hard' ? 3.4 : 3.0) * s; // EASY slower, HARD faster
    world.groundY = Math.round(H - Math.max(36, 0.08 * H));
    world.skyColor = mode === 'easy' ? '#FFF7BF' : mode === 'hard' ? '#9CA3AF' : '#87CEEB';

    // Position/scale bird
    birdRef.current = {
      x: Math.round(W * 0.18),
      y: Math.round(H * 0.5),
      vy: 0,
      r: Math.max(14, Math.round(16 * s)),
      wingAngle: 0,
    };

    // Generate fresh pipes when size or mode changes (auto-restart)
    pipesRef.current = generateInitialPipes(W);
    scoredSetRef.current.clear();
    gameOverRef.current = false;
    setScore(0);
    scoreRef.current = 0;
    setRunning(true);
    setPaused(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displaySize.w, displaySize.h, mode]);

  // Helpers
  function randRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function generateInitialPipes(W) {
    const arr = [];
    const spacing = worldRef.current.pipeSpacing;
    const startX = W + Math.round(spacing * 0.6);
    for (let i = 0; i < 6; i++) {
      const x = startX + i * spacing;
      arr.push(makePipeAtX(x));
    }
    return arr;
  }

  function makePipeAtX(x) {
    const world = worldRef.current;
    const H = displaySize.h;

    const marginTop = Math.round(0.06 * H); // 6% top margin
    const marginBottom = Math.round(0.06 * H); // 6% above ground

    // Allowed range for TOP pipe height so the gap fully fits
    const maxTopAllowed = world.groundY - marginBottom - world.pipeGap;
    const minTopAllowed = marginTop;

    const minTop = Math.max(0, Math.min(minTopAllowed, maxTopAllowed));
    const maxTop = Math.max(minTop, maxTopAllowed);

    const topH = randRange(minTop, maxTop);
    return { x, topH };
  }

  const resetGame = () => {
    const { w: W, h: H } = displaySize;
    birdRef.current = {
      x: Math.round(W * 0.18),
      y: Math.round(H * 0.5),
      vy: 0,
      r: birdRef.current.r,
      wingAngle: 0,
    };
    pipesRef.current = generateInitialPipes(W);
    scoredSetRef.current.clear();
    gameOverRef.current = false;
    setScore(0);
    scoreRef.current = 0;
  };

  // === Simple WebAudio SFX ===
  const audioRef = useRef({ ctx: null });
  function ensureAudio() {
    if (!audioRef.current.ctx) {
      try {
        audioRef.current.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch {}
    }
    const ctx = audioRef.current.ctx;
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }
  function beep(freq = 440, dur = 0.08, type = 'square', gain = 0.05) {
    const ctx = audioRef.current.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = gain;
    osc.connect(g);
    g.connect(ctx.destination);
    const now = ctx.currentTime;
    osc.start(now);
    osc.stop(now + dur);
  }
  const sfxFlap = () => { beep(760, 0.06, 'square', 0.06); };
  const sfxScore = () => { beep(520, 0.09, 'triangle', 0.06); };
  const sfxGameOver = () => { beep(180, 0.25, 'sawtooth', 0.07); };

  const flap = () => {
    ensureAudio();
    if (!running) {
      setRunning(true);
      setPaused(false);
      resetGame();
      return;
    }
    if (gameOverRef.current) {
      setPaused(false);
      resetGame();
      return;
    }
    if (!paused) {
      birdRef.current.vy = worldRef.current.flap;
      birdRef.current.wingAngle = -0.8;
      sfxFlap();
    }
  };

  // Input handlers
  useEffect(() => {
    const onKey = (e) => {
      // Handle space bar and arrow up for flapping
      if (e.code === 'Space' || e.key === ' ' || e.code === 'ArrowUp') {
        e.preventDefault();
        ensureAudio();
        flap();
      } 
      // Handle P key for pause
      else if (e.code === 'KeyP' || e.key === 'p') {
        e.preventDefault();
        togglePause();
      } 
      // Handle R key for restart
      else if (e.code === 'KeyR' || e.key === 'r') {
        e.preventDefault();
        if (running) {
          resetGame();
          setRunning(true);
          setPaused(false);
        } else {
          setRunning(true);
          resetGame();
        }
      }
      // Handle Enter key for starting/restarting
      else if (e.code === 'Enter') {
        e.preventDefault();
        if (!running) {
          setRunning(true);
          setPaused(false);
          resetGame();
        } else if (gameOverRef.current) {
          resetGame();
          setRunning(true);
          setPaused(false);
        }
      }
    };

    // Add event listeners for both keydown and keypress (for better browser compatibility)
    window.addEventListener('keydown', onKey, { passive: false });
    window.addEventListener('keypress', onKey, { passive: false });
    
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keypress', onKey);
    };
  }, [running, paused, gameOverRef]);

  // Animation loop
  useEffect(() => {
    const loop = () => {
      update();
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    if (running && !paused) {
      rafRef.current = requestAnimationFrame(loop);
    }
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, paused]);

  // === Game Update ===
  function update() {
    if (!running || paused) return;

    const bird = birdRef.current;
    const world = worldRef.current;
    const { w: W } = displaySize;

    // Physics
    bird.vy += world.gravity;
    bird.y += bird.vy;
    if (bird.wingAngle < 0) {
      bird.wingAngle = Math.min(bird.wingAngle + 0.2, 0);
    }

    // Move pipes
    const pipes = pipesRef.current;
    for (let i = 0; i < pipes.length; i++) {
      pipes[i].x -= world.speed;
    }

    // Recycle pipes that go off-screen and add new ones
    while (pipes.length && pipes[0].x + world.pipeWidth < -10) {
      pipes.shift();
      const lastX = pipes[pipes.length - 1].x;
      pipes.push(makePipeAtX(lastX + world.pipeSpacing));
    }

    // Spawn initial if empty (edge case during resize)
    if (pipes.length === 0) {
      pipes.push(...generateInitialPipes(W));
    }

    // Collision detection
    const groundY = world.groundY;
    if (bird.y + bird.r > groundY) {
      bird.y = groundY - bird.r;
      endGame();
      return;
    }
    if (bird.y - bird.r < 0) {
      bird.y = bird.r;
      bird.vy = 0;
    }

    for (let i = 0; i < pipes.length; i++) {
      const p = pipes[i];
      const gapTop = p.topH;
      const gapBottom = p.topH + world.pipeGap;
      const pipeLeft = p.x;
      const pipeRight = p.x + world.pipeWidth;

      // Overlap horizontally?
      const inX = bird.x + bird.r > pipeLeft && bird.x - bird.r < pipeRight;
      if (inX) {
        if (bird.y - bird.r < gapTop || bird.y + bird.r > gapBottom) {
          endGame();
          return;
        }
      }

      // Score when passing center of pipe
      const passX = p.x + world.pipeWidth / 2;
      if (passX < bird.x && !scoredSetRef.current.has(p)) {
        scoredSetRef.current.add(p);
        setScore((s) => {
          const next = s + 1;
          scoreRef.current = next; // keep ref in sync for canvas draw
          if (next > best) {
            setBest(next);
            try { localStorage.setItem('flappy_best', String(next)); } catch {}
          }
          sfxScore();
          return next;
        });
      }
    }

    world.t += 1;
  }

  function endGame() {
    if (!gameOverRef.current) {
      gameOverRef.current = true;
      setPaused(true);
      sfxGameOver();
    }
  }

  function togglePause() {
    if (!running) return;
    setPaused((p) => !p);
  }

  // === Rendering ===
  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { w: W, h: H } = displaySize;

    // Sky: Draw a gradient for normal mode, solid color otherwise.
    // This makes the canvas background match the page background seamlessly.
    if (mode === 'normal') {
        const gradient = ctx.createLinearGradient(0, 0, 0, H);
        gradient.addColorStop(0, '#bae6fd');
        gradient.addColorStop(1, '#60a5fa');
        ctx.fillStyle = gradient;
    } else {
        ctx.fillStyle = worldRef.current.skyColor;
    }
    ctx.fillRect(0, 0, W, H);

    // Clouds parallax (three layers, more clouds on screen)
    const t = worldRef.current.t;
    drawCloudLayer(ctx, W, H, t * 0.20, 240, 0.14, 16, 9);
    drawCloudLayer(ctx, W, H, t * 0.35, 300, 0.22, 20, 8);
    drawCloudLayer(ctx, W, H, t * 0.50, 380, 0.30, 24, 7);

    // Ground
    const groundH = Math.max(36, Math.round(0.08 * H));
    ctx.fillStyle = '#DEB887';
    ctx.fillRect(0, H - groundH, W, groundH);

    // Pipes
    drawPipes(ctx, W, H);

    // Bird
    drawBird(ctx);

    // For the HUD
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // Hints
    if (!running) {
      ctx.font = '600 14px "Press Start 2P", ui-monospace, monospace';
      shadowText(ctx, 'Tap/Click/Space to start', W / 2, H / 2 - 12);
    } else if (gameOverRef.current) {
      ctx.font = 'bold 48px "Press Start 2P", ui-monospace, monospace';
      shadowText(ctx, 'Game Over', W / 2, H / 2 - 30);
      ctx.font = '600 14px "Press Start 2P", ui-monospace, monospace';
      shadowText(ctx, 'Press Space to Restart', W / 2, H / 2 + 20);
    }
  }

  function drawCloudLayer(ctx, W, H, t, step, yFrac, rBase, count) {
    for (let i = 0; i < count; i++) {
      const x = ((i * step - (t % (W + step))) % (W + step)) - step / 2;
      cloud(ctx, x, Math.round(yFrac * H) + (i % 3) * Math.round(0.04 * H), rBase + (i % 4) * 6);
    }
  }

  function drawPipes(ctx, W, H) {
    const pipes = pipesRef.current;
    const { pipeWidth, pipeGap, groundY } = worldRef.current;
    ctx.fillStyle = '#2ecc71';
    ctx.strokeStyle = '#27ae60';
    ctx.lineWidth = 4;
    pipes.forEach((p) => {
      // Top pipe
      ctx.beginPath();
      ctx.rect(p.x, 0, pipeWidth, p.topH);
      ctx.fill();
      ctx.stroke();

      // Bottom pipe
      const bottomY = p.topH + pipeGap;
      ctx.beginPath();
      ctx.rect(p.x, bottomY, pipeWidth, groundY - bottomY);
      ctx.fill();
      ctx.stroke();
    });
  }

  function drawBird(ctx) {
    const b = birdRef.current;
    ctx.save();
    ctx.translate(b.x, b.y);
    const angle = Math.max(-0.6, Math.min(0.8, b.vy / 10));
    ctx.rotate(angle);

    // Body
    ctx.fillStyle = '#f1c40f';
    roundRect(ctx, -b.r, -b.r, b.r * 2, b.r * 2, 8);
    ctx.fill();

    // Wing
    ctx.fillStyle = '#f39c12';
    ctx.save();
    ctx.translate(-8, 0);
    ctx.rotate(b.wingAngle || 0);
    roundRect(ctx, 0, -4, 16, 8, 4);
    ctx.fill();
    ctx.restore();

    // Eye
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(6, -6, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2c3e50';
    ctx.beginPath();
    ctx.arc(7, -6, 2, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = '#e67e22';
    ctx.beginPath();
    ctx.moveTo(b.r, 0);
    ctx.lineTo(b.r + 10, 4);
    ctx.lineTo(b.r, 8);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  // Drawing utils
  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
  }

  function shadowText(ctx, text, x, y) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillText(text, x + 2, y + 2);
    ctx.fillStyle = '#1f2937';
    if (worldRef.current.skyColor === '#87CEEB') ctx.fillStyle = '#ffffff';
    ctx.fillText(text, x, y);
  }

  function cloud(ctx, x, y, r) {
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.arc(x + r, y + 4, r * 0.75, 0, Math.PI * 2);
    ctx.arc(x - r, y + 6, r * 0.7, 0, Math.PI * 2);
    ctx.arc(x + r * 1.6, y + 2, r * 0.6, 0, Math.PI * 2);
    ctx.arc(x - r * 1.4, y + 3, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }

  // UI
  const { w: W, h: H } = displaySize;
  // The page background now matches the solid sky color for a seamless look.
  const pageBackgroundColor = mode === 'easy' ? '#FFF7BF' : mode === 'hard' ? '#9CA3AF' : '#87CEEB';

  return (
    <div className="w-full min-h-screen flex flex-col items-center justify-center p-4" style={{ background: pageBackgroundColor }}>
        <div className="relative" style={{ width: W, height: H, fontFamily: '"Press Start 2P", ui-monospace, monospace' }}>
            {/* Overlay HUD */}
            <div className="absolute -top-16 left-1/2 -translate-x-1/2 flex items-center gap-3 text-white drop-shadow-md bg-black/40 text-white rounded-2xl px-4 py-2 flex items-center justify-center gap-x-6 gap-y-2 flex-wrap shadow-lg">
                <span className="text-base sm:text-lg">Score: <span className="font-bold w-12 inline-block">{score}</span></span>
                <span className="text-base sm:text-lg">Best: <span className="font-bold w-12 inline-block">{best}</span></span>
                <div className="flex items-center gap-2">
                    <label htmlFor="mode-select" className="text-base sm:text-lg">Mode:</label>
                    <select
                        id="mode-select"
                        className="bg-white/20 text-white rounded-lg px-2 py-1 text-base border-none focus:ring-2 focus:ring-white/50 appearance-none"
                        style={{
                          background: "rgba(255,255,255,0.2) url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23ffffff%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E') no-repeat right .7em center/8px 10px",
                          minWidth: "100px",     // ensures space for text
                          paddingRight: "2em",   // makes room for the arrow
                        }}
                        value={mode}
                        onChange={(e) => {
                            const m = e.target.value;
                            setMode(m);
                            resetGame();
                            setRunning(true);
                            setPaused(false);
                            ensureAudio();
                        }}
                    >
                        <option style={{color: 'black'}} value="easy">Easy</option>
                        <option style={{color: 'black'}} value="normal">Normal</option>
                        <option style={{color: 'black'}} value="hard">Hard</option>
                    </select>
                </div>
            </div>

            <canvas
                ref={canvasRef}
                width={W}
                height={H}
                className="rounded-2xl shadow-xl border border-white/40 bg-transparent select-none touch-none"
                onMouseDown={() => { ensureAudio(); flap(); }}
                onTouchStart={(e) => {
                    e.preventDefault();
                    ensureAudio();
                    flap();
                }}
            />
        </div>
        
        {/* Controls */}
        <div className="mt-4 flex items-center justify-center gap-2" style={{ fontFamily: '"Press Start 2P", ui-monospace, monospace' }}>
          <button
            className="px-4 py-2 rounded-2xl shadow bg-white text-slate-800 hover:shadow-lg active:scale-[0.98] text-sm"
            onClick={() => {
              ensureAudio();
              if (!running) {
                setRunning(true);
                setPaused(false);
                resetGame();
              } else if (gameOverRef.current) {
                resetGame();
                setPaused(false);
              } else {
                flap();
              }
            }}
          >
            {running && !gameOverRef.current ? 'Flap (Space)' : 'Start'}
          </button>

          <button
            className="px-4 py-2 rounded-2xl shadow bg-white/90 text-slate-800 hover:shadow-lg active:scale-[0.98] text-sm"
            onClick={() => { ensureAudio(); togglePause(); }}
            disabled={!running}
          >
            {paused ? 'Resume (P)' : 'Pause (P)'}
          </button>

          <button
            className="px-4 py-2 rounded-2xl shadow bg-white/90 text-slate-800 hover:shadow-lg active:scale-[0.98] text-sm"
            onClick={() => {
              ensureAudio();
              setRunning(true);
              setPaused(false);
              resetGame();
            }}
          >
            Restart (R)
          </button>
        </div>

        {/* Tips */}
        <p className="mt-3 text-center text-white/90 text-xs" style={{ fontFamily: '"Press Start 2P", ui-monospace, monospace' }}>
          Space/Up/Click/Tap to Flap
        </p>
    </div>
  );
}
