// A single image flying across the top of the screen, for a slide payoff beat. Same
// shape as confetti.ts: nothing exists until it fires, it removes itself when it
// leaves the frame, and only one is ever in flight.
//
// The artwork (public/img/eagle-flying.gif) faces left, so the flight runs right →
// left and the frames are never mirrored. Motion is a CSS animation (`@keyframes
// flyby` in index.css) rather than a rAF loop — it stays on the compositor, so it
// can't cost the 3D scene a frame.

const FLIGHT_MS = 4200

let stopPrevious: (() => void) | null = null

// Warm the image so the first flight doesn't start on a blank frame.
export function preloadFlyby(src: string) {
  const img = new Image()
  img.src = import.meta.env.BASE_URL + src
}

// Cancel a flight in progress (the deck closing mid-celebration).
export function stopFlyby() {
  stopPrevious?.()
}

export function flyby(src: string) {
  stopPrevious?.()

  const img = document.createElement('img')
  img.className = 'flyby'
  img.src = import.meta.env.BASE_URL + src
  img.alt = ''
  img.setAttribute('aria-hidden', 'true')

  const stop = () => {
    clearTimeout(timer)
    img.remove()
    if (stopPrevious === stop) stopPrevious = null
  }
  // animationend is the normal path; the timeout covers a tab that never animates
  img.addEventListener('animationend', stop)
  const timer = window.setTimeout(stop, FLIGHT_MS + 800)
  stopPrevious = stop

  document.body.appendChild(img)
  return stop
}
