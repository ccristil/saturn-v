// Confetti burst for a slide payoff beat. Hand-rolled on a throwaway <canvas> — no
// dependency, nothing mounted until it fires, and it removes itself when the last
// piece falls off screen. Flag red/white/blue plus the brand accent.
//
// Two cannons on the left and right edges, firing inward across the frame with a
// slight upward toss — the pieces cross, stall, and flutter down. Reads as celebration
// rather than snowfall.

const COLORS = ['#b31942', '#ffffff', '#0c81cf', '#0a3161', '#e8edf5']
const PIECES = 140 // per cannon — both fire on the same frame
const GRAVITY = 0.3
const DRAG = 0.972 // sideways only: each piece coasts inward, then stalls and flutters
const MAX_MS = 7000 // hard stop, so a backgrounded tab can never leave it running

type Piece = {
  x: number
  y: number
  vx: number
  vy: number
  w: number
  h: number
  rot: number
  vr: number
  color: string
  wobble: number
  sway: number // horizontal flutter amplitude on the way down
  fall: number // terminal velocity — paper falls slowly, and not all at one speed
}

// Only ever one burst on screen — a presenter who steps back and forward again gets a
// fresh one, not two canvases stacked.
let stopPrevious: (() => void) | null = null

// Kill any burst in flight (the deck closing mid-celebration).
export function stopConfetti() {
  stopPrevious?.()
}

export function fireConfetti() {
  stopPrevious?.()

  const canvas = document.createElement('canvas')
  canvas.className = 'confetti'
  canvas.setAttribute('aria-hidden', 'true')
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  document.body.appendChild(canvas)

  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  let w = 0
  let h = 0
  const resize = () => {
    w = window.innerWidth
    h = window.innerHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  resize()
  window.addEventListener('resize', resize)

  const rand = (a: number, b: number) => a + Math.random() * (b - a)
  const pieces: Piece[] = []
  for (const from of [
    { x: -14, dir: 1 },
    { x: w + 14, dir: -1 },
  ]) {
    for (let i = 0; i < PIECES; i++) {
      // Launch velocity is picked per axis rather than as an angle, because each axis
      // has its own budget: vx sets how far the piece coasts inward against DRAG
      // (vx × ~36px, so 3–42 spans a piece that barely clears its own edge to one that
      // crosses the whole frame), vy is only a light toss so it rises a little before
      // falling. The wide vx spread is what keeps coverage even — a narrow one stalls
      // every piece in the middle third and leaves both sides looking bare.
      pieces.push({
        x: from.x,
        y: rand(0.2, 0.7) * h, // fanned down the edge, not a single point
        vx: rand(3, 42) * from.dir, // dir aims the cannon inward
        vy: -rand(4, 16),
        w: rand(7, 13),
        h: rand(9, 17),
        rot: rand(0, Math.PI * 2),
        vr: rand(-0.24, 0.24),
        color: COLORS[(Math.random() * COLORS.length) | 0],
        wobble: rand(0, Math.PI * 2),
        sway: rand(0.4, 1.6),
        fall: rand(3.5, 7),
      })
    }
  }
  let raf = 0
  let last = performance.now()
  const started = last

  const stop = () => {
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', resize)
    canvas.remove()
    if (stopPrevious === stop) stopPrevious = null
  }
  stopPrevious = stop

  const frame = (now: number) => {
    // normalize to 60fps steps, and clamp so a stalled frame can't teleport the pieces
    const dt = Math.min((now - last) / 16.667, 3)
    last = now
    ctx.clearRect(0, 0, w, h)

    let alive = 0
    for (const p of pieces) {
      p.vy = Math.min(p.vy + GRAVITY * dt, p.fall) // terminal velocity: flutter, don't plummet
      p.vx *= DRAG ** dt
      p.x += (p.vx + Math.cos(p.wobble) * p.sway) * dt
      p.y += p.vy * dt
      p.rot += p.vr * dt
      p.wobble += 0.12 * dt
      // gone off any edge — stop drawing it, and let the burst end once all have gone
      if (p.y - p.h > h || p.x < -60 || p.x > w + 60) continue
      alive++
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      // squash horizontally on the wobble so each piece reads as a tumbling rectangle
      ctx.scale(Math.cos(p.wobble), 1)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
      ctx.restore()
    }

    if (alive === 0 || now - started > MAX_MS) stop()
    else raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)

  return stop
}
