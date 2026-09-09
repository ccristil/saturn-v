import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import type { Slide } from '../content/slides'
import { fireConfetti, stopConfetti } from './confetti'
import { flyby, preloadFlyby, stopFlyby } from './flyby'

// Timeline axis color ramp: faint white at the first stop → full accent blue at the
// last, so the line itself heats up left → right. Segments are drawn per-stop and
// abut, so each one runs from its own color to the next stop's — continuous overall.
const SEG_FROM = [255, 255, 255]
const SEG_TO = [12, 129, 207] // --accent
function segColor(t: number) {
  const c = Math.max(0, Math.min(1, t))
  const [r, g, b] = SEG_FROM.map((from, i) => Math.round(from + (SEG_TO[i] - from) * c))
  return `rgba(${r}, ${g}, ${b}, ${(0.3 + 0.7 * c).toFixed(2)})`
}

// Draw-on timing. The axis draws left → right at a constant speed and each dot pops
// as the line reaches it; everything is derived from the stop count, so a timeline of
// any length draws at the same speed. Ends replay on every visit to the slide (the
// deck slide is keyed on index, so it remounts).
const COL_MS = 280 // time to draw one column-width of axis
const HOLD_MS = 200 // beat before the line starts moving
function timelineTiming(n: number) {
  const lineStart: number[] = []
  const lineDur: number[] = []
  const dotAt: number[] = []
  let t = HOLD_MS
  for (let i = 0; i < n; i++) {
    // the outer stops only carry half a column (the line starts and ends at a dot)
    const dur = i === 0 || i === n - 1 ? COL_MS / 2 : COL_MS
    lineStart[i] = t
    lineDur[i] = dur
    // the line passes a middle dot at its column's midpoint; the last dot is the end
    dotAt[i] = i === 0 ? 0 : i === n - 1 ? t + dur : t + dur / 2
    t += dur
  }
  return { lineStart, lineDur, dotAt, end: t }
}

// Fullscreen slide deck overlay. Keyboard nav is owned by App; this also allows
// click-the-slide-to-advance (touch-friendly) plus explicit footer/exit controls.
export function Presentation({
  slides,
  index,
  revealed = 0,
  exiting = false,
  hero = false,
  onNext,
  onPrev,
  onExit,
}: {
  slides: Slide[]
  index: number
  revealed?: number // how many of this slide's bullets the presenter has stepped through
  exiting?: boolean
  hero?: boolean // last slide: deck goes transparent so the live 3D model shows behind
  onNext: () => void
  onPrev: () => void
  onExit: () => void
}) {
  const slide = slides[index]
  const atStart = index === 0 && revealed === 0

  // Bullet payoff cues — sound and confetti. Audio is preloaded on arrival so it lands
  // on the beat, and both fire only when a bullet is revealed going forward: never on
  // re-render, and never on the way back through a slide. Stepping backwards (or
  // leaving the deck) stops whatever is playing, which is the presenter's kill switch
  // for a cue that outlasts the moment — the anthem runs 16.5s. Autoplay refusals are
  // swallowed: the deck must never break because the browser wouldn't make a noise.
  const cues = useRef<Record<string, HTMLAudioElement>>({})
  const playing = useRef<HTMLAudioElement[]>([])
  const timers = useRef<number[]>([])
  const lastStep = useRef({ index, revealed })

  useEffect(() => {
    for (const cue of slide.bullets?.flatMap((b) => b.sounds ?? []) ?? []) {
      if (!cues.current[cue.src]) {
        const a = new Audio(import.meta.env.BASE_URL + cue.src)
        a.preload = 'auto'
        cues.current[cue.src] = a
      }
    }
    for (const b of slide.bullets ?? []) if (b.flyby) preloadFlyby(b.flyby)
  }, [slide])

  const stopCues = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    for (const a of playing.current) {
      a.pause()
      a.currentTime = 0
    }
    playing.current = []
  }

  useEffect(() => {
    const prev = lastStep.current
    lastStep.current = { index, revealed }
    const steppedForward = prev.index === index && revealed > prev.revealed
    if (!steppedForward) {
      // stepped back, or changed slide — the moment has passed, cut it short
      stopCues()
      stopConfetti()
      stopFlyby()
      return
    }

    const bullet = slide.bullets?.[revealed - 1]
    if (!bullet) return
    if (bullet.confetti) fireConfetti()
    if (bullet.flyby) flyby(bullet.flyby)

    for (const cue of bullet.sounds ?? []) {
      const audio = cues.current[cue.src]
      if (!audio) continue
      const play = () => {
        audio.currentTime = 0
        audio.volume = cue.volume ?? 1
        playing.current.push(audio)
        audio.play().catch(() => {})
      }
      if (cue.delay) timers.current.push(window.setTimeout(play, cue.delay))
      else play()
    }
  }, [index, revealed, slide])

  // Leaving the deck mid-celebration must not leave the anthem playing over the 3D
  // walkthrough, or confetti raining on it.
  useEffect(
    () => () => {
      stopCues()
      stopConfetti()
      stopFlyby()
    },
    [],
  )

  const timing = slide.timeline ? timelineTiming(slide.timeline.length) : null
  const tailDelay = timing ? timing.end + 150 : 0

  // Race bars are drawn as a fraction of the slide's longest lane, so every lane is
  // measured against the same scale. On a race slide the kicker is the final
  // presenter beat (one step past the last lane) rather than a timed tail.
  const raceMax = slide.race ? Math.max(...slide.race.lanes.map((l) => l.days)) : 1
  const kickerStepped = !!slide.race
  const kickerShown = kickerStepped && revealed > slide.race!.lanes.length

  return (
    <div
      className={['deck', hero && 'deck--hero', exiting && 'deck--exiting']
        .filter(Boolean)
        .join(' ')}
    >
      <button className="deck__exit" onClick={onExit} aria-label="Exit presentation">
        ✕
      </button>

      <div
        key={index}
        className={`deck__slide deck__slide--${slide.kind ?? 'content'}`}
        onClick={onNext}
      >
        {slide.eyebrow && <div className="deck__eyebrow">{slide.eyebrow}</div>}
        <h1 className="deck__title">{slide.title}</h1>
        {slide.subtitle && <p className="deck__subtitle">{slide.subtitle}</p>}
        {slide.body?.map((p, i) => (
          <p className="deck__body" key={i}>
            {p}
          </p>
        ))}

        {slide.bullets && (
          <ul className="deck__bullets">
            {slide.bullets.map((b, i) => (
              // Unrevealed bullets keep their space (opacity only) so nothing reflows
              // under the presenter mid-sentence.
              <li className={`deck__bullet${i < revealed ? ' is-shown' : ''}`} key={b.text}>
                <span className="deck__bulletmark" aria-hidden />
                {b.text}
              </li>
            ))}
          </ul>
        )}

        {slide.race && (
          <div className="race">
            {slide.race.lanes.map((lane, i) => (
              // One lane per presenter step. Bars share one scale — the longest lane on
              // the slide is full width — so two near-identical spans read as
              // near-identical bars rather than as a coincidence of layout. Hidden
              // lanes keep their space (opacity only), so nothing reflows mid-sentence.
              <div
                className={[
                  'race__lane',
                  i < revealed && 'is-shown',
                  lane.accent && 'race__lane--accent',
                ]
                  .filter(Boolean)
                  .join(' ')}
                key={lane.name}
                style={{ '--w': `${(lane.days / raceMax) * 100}%` } as CSSProperties}
              >
                <div className="race__head">
                  <span className="race__name">{lane.name}</span>
                  <span className="race__days">{lane.days.toLocaleString()} days</span>
                </div>
                <div className="race__track">
                  <div className="race__bar" />
                </div>
                <div className="race__ends">
                  <div className="race__end">
                    <div className="race__date">{lane.from.date}</div>
                    <div className="race__note">{lane.from.note}</div>
                  </div>
                  <div className="race__end race__end--to">
                    <div className="race__date">{lane.to.date}</div>
                    <div className="race__note">{lane.to.note}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {slide.timeline && (
          <div className="tl">
            <div className="tl__track">
              {slide.timeline.map((stop, i, all) => {
                const last = all.length - 1
                return (
                <div
                  className="tl__stop"
                  key={stop.year}
                  style={
                    {
                      // draw-on: the line segment, then the dot it reaches, then the label
                      '--line-delay': `${timing!.lineStart[i]}ms`,
                      '--line-dur': `${timing!.lineDur[i]}ms`,
                      '--dot-delay': `${timing!.dotAt[i]}ms`,
                      '--label-delay': `${timing!.dotAt[i] + 90}ms`,
                      // the dot grows along the axis; the two bookends are overridden
                      // to their own sizes in CSS (--start / --end)
                      '--dot': `${15 + i * 3}px`,
                      // this stop's segment runs to the next stop's color; the final
                      // one is clipped to its left half, so it starts a step back
                      '--c0': segColor((i === last ? i - 1 : i) / last),
                      '--c1': segColor((i === last ? i : i + 1) / last),
                    } as CSSProperties
                  }
                >
                  <div className="tl__year">{stop.year}</div>
                  <div className="tl__mark">
                    <span
                      className={`tl__dot${
                        i === 0 ? ' tl__dot--start' : i === last ? ' tl__dot--end' : ''
                      }`}
                    />
                  </div>
                  <div className="tl__label">{stop.label}</div>
                </div>
                )
              })}
            </div>
            {slide.span && (
              <>
                <div className="tl__span" style={{ animationDelay: `${tailDelay}ms` }} />
                <div className="tl__spanlabel" style={{ animationDelay: `${tailDelay + 90}ms` }}>
                  {slide.span}
                </div>
              </>
            )}
          </div>
        )}

        {slide.kicker && (
          <p
            className={[
              'deck__kicker',
              kickerStepped && 'deck__kicker--step',
              kickerShown && 'is-shown',
            ]
              .filter(Boolean)
              .join(' ')}
            style={kickerStepped ? undefined : { animationDelay: `${tailDelay + 200}ms` }}
          >
            {slide.kicker}
          </p>
        )}
      </div>

      <div className="deck__footer">
        <button className="deck__nav" onClick={onPrev} disabled={atStart}>
          ← Prev
        </button>
        <span className="deck__counter">
          {String(index + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
        </span>
        <button className="deck__nav deck__nav--primary" onClick={onNext}>
          Next →
        </button>
      </div>
    </div>
  )
}
