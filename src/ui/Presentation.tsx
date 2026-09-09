import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Slide } from '../content/slides'
import { slideSteps } from '../content/slides'
import { fireConfetti, stopConfetti } from './confetti'
import { flyby, preloadFlyby, stopFlyby } from './flyby'
import { ScaleCompare } from './ScaleCompare'

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

  // The photo's rendered width, which the slide's right padding clears (see
  // .deck__slide--has-image). Measured rather than assumed: the deck's photos aren't
  // all the same shape, and a fixed column would crop the portrait ones or strand a
  // third of the slide beside the landscape ones. A cached image can already be
  // complete when the ref lands, so measure there as well as on load.
  const [imgW, setImgW] = useState(0)
  const measureImage = (el: HTMLImageElement | null) => {
    if (el?.complete && el.naturalWidth) setImgW(el.getBoundingClientRect().width)
  }

  // Bullet payoff cues — sound and confetti. Audio is preloaded on arrival so it lands
  // on the beat, and both fire only when a bullet is revealed going forward: never on
  // re-render, and never on the way back through a slide. Stepping backwards (or
  // leaving the deck) stops whatever is playing, which is the presenter's kill switch
  // for a cue that outlasts the moment — the anthem runs 16.5s. Autoplay refusals are
  // swallowed: the deck must never break because the browser wouldn't make a noise.
  const cues = useRef<Record<string, HTMLAudioElement>>({})
  const playing = useRef<HTMLAudioElement[]>([])
  const timers = useRef<number[]>([])
  const fadeTimer = useRef<number | null>(null)
  const lastStep = useRef({ index, revealed })
  const beats = slideSteps(slide)

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
    if (fadeTimer.current !== null) clearInterval(fadeTimer.current)
    fadeTimer.current = null
    timers.current.forEach(clearTimeout)
    timers.current = []
    for (const a of playing.current) {
      a.pause()
      a.currentTime = 0
    }
    playing.current = []
  }

  // Take everything currently playing down to silence over `ms`, then stop it for
  // real. A raised-cosine ramp — it leaves and arrives at zero slope, so it reads as
  // the music receding rather than as someone turning a knob. Volumes aren't restored
  // here: every cue sets its own on play, so a replay comes back at full level.
  //
  // On an interval rather than requestAnimationFrame on purpose. This is a scalar
  // ramp, not something that needs to land on a vsync, and rAF only fires when the
  // compositor is producing frames — if it stalls, the fade jumps instead of tapering,
  // in the middle of the talk. Elapsed time is read from the clock each tick, so the
  // fade still finishes on schedule even if ticks are late.
  const fadeOutCues = (ms: number) => {
    const audios = [...playing.current]
    if (!audios.length) return
    const from = audios.map((a) => a.volume)
    const start = performance.now()
    fadeTimer.current = window.setInterval(() => {
      const t = Math.min(1, (performance.now() - start) / ms)
      const k = 0.5 * (1 + Math.cos(Math.PI * t))
      audios.forEach((a, i) => {
        a.volume = Math.max(0, Math.min(1, from[i] * k))
      })
      if (t >= 1) stopCues()
    }, 25)
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

    // The trailing fade beat: nothing new on screen, so the presenter can keep
    // talking over the slide while the sound recedes under them.
    if (slide.fadeCues && revealed === beats.fadeBeat) {
      fadeOutCues(slide.fadeCues)
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

  // A gallery slide holds one photo per presenter beat. The whole set is in the DOM at
  // once (crossfading on opacity), and every gallery in the deck is warmed the moment
  // the deck opens — so stepping to the next photo never waits on a download in front
  // of the room. Clamped, because stepping back into a finished slide sets `revealed`
  // to its full step count.
  useEffect(() => {
    for (const s of slides)
      for (const img of s.gallery?.images ?? []) {
        const pre = new Image()
        pre.src = import.meta.env.BASE_URL + img.src
      }
  }, [slides])
  const shot = slide.gallery ? Math.min(revealed, slide.gallery.images.length - 1) : 0

  const timing = slide.timeline ? timelineTiming(slide.timeline.length) : null
  const tailDelay = timing ? timing.end + 150 : 0

  // Race bars are drawn as a fraction of the slide's longest lane, so every lane is
  // measured against the same scale. On a race slide the kicker is the final
  // presenter beat (one step past the last lane) rather than a timed tail.
  const raceMax = slide.race ? Math.max(...slide.race.lanes.map((l) => l.days)) : 1
  // On a race slide the kicker and the to-scale drawing are the last two presenter
  // beats rather than timed tails — each waits for its own step and reverses on ←.
  const stepped = !!slide.race
  const kickerShown = stepped && revealed >= beats.kickerBeat
  const scaleShown = stepped && revealed >= beats.scaleBeat

  // A `map` slide is a full-bleed embedded page — it carries its own headings (fed
  // from this slide's eyebrow/title/subtitle on the query string), so the deck's own
  // text block is suppressed rather than drawn twice. The iframe swallows its own
  // clicks, so click-to-advance is off inside it; the footer and → still advance, and
  // the embedded page forwards arrow keys back out (see App) so keyboard nav survives
  // the presenter clicking into the map.
  const mapSrc = slide.map
    ? import.meta.env.BASE_URL +
      slide.map.src +
      '?' +
      new URLSearchParams({
        eyebrow: slide.eyebrow ?? '',
        title: slide.title,
        subtitle: slide.subtitle ?? '',
      }).toString()
    : null

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
        className={[
          'deck__slide',
          `deck__slide--${slide.kind ?? 'content'}`,
          slide.scale && 'deck__slide--split',
          slide.image && 'deck__slide--has-image',
          slide.gallery && 'deck__slide--gallery',
          mapSrc && 'deck__slide--map',
        ]
          .filter(Boolean)
          .join(' ')}
        style={slide.image && imgW ? ({ '--img-w': `${imgW}px` } as CSSProperties) : undefined}
        onClick={mapSrc ? undefined : onNext}
      >
        {slide.image && (
          <figure className="deck__imagewrap">
            <img
              className="deck__image"
              ref={measureImage}
              onLoad={(e) => setImgW(e.currentTarget.getBoundingClientRect().width)}
              src={import.meta.env.BASE_URL + slide.image.src}
              alt={slide.image.alt}
            />
            {slide.image.caption && (
              <figcaption className="deck__imagecaption">{slide.image.caption}</figcaption>
            )}
          </figure>
        )}
        {mapSrc && (
          <iframe className="deck__map" src={mapSrc} title={slide.title} />
        )}
        {!mapSrc && slide.eyebrow && <div className="deck__eyebrow">{slide.eyebrow}</div>}
        {!mapSrc && <h1 className="deck__title">{slide.title}</h1>}
        {/* A `scale` slide splits below the title: the argument on the left, the
            to-scale drawing in the right-hand column. Without one, the same content
            runs full width. */}
        {mapSrc ? null : slide.scale ? (
          <div className="deck__split">
            <div className="deck__splitmain">
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
                stepped && 'deck__kicker--step',
                kickerShown && 'is-shown',
              ]
                .filter(Boolean)
                .join(' ')}
              style={stepped ? undefined : { animationDelay: `${tailDelay + 200}ms` }}
            >
              {slide.kicker}
            </p>
          )}
            </div>
            <ScaleCompare scale={slide.scale} stepped={stepped} shown={scaleShown} />
          </div>
        ) : (
          <>
          {slide.subtitle && <p className="deck__subtitle">{slide.subtitle}</p>}
          {slide.body?.map((p, i) => (
            <p className="deck__body" key={i}>
              {p}
            </p>
          ))}

          {slide.gallery && (
            <div className="gallery">
              {/* Every photo is stacked in the same box and crossfaded on opacity, so
                  a portrait shot following a landscape one doesn't resize the slide
                  under the presenter. */}
              <div className="gallery__stage">
                {slide.gallery.images.map((img, i) => (
                  <figure
                    className={`gallery__item${i === shot ? ' is-shown' : ''}`}
                    key={img.src}
                    aria-hidden={i !== shot}
                  >
                    <img
                      className="gallery__image"
                      src={import.meta.env.BASE_URL + img.src}
                      alt={img.alt}
                    />
                  </figure>
                ))}
              </div>
              {/* The caption sits below the stage rather than inside it: contained
                  photos land at different heights, and a caption that moved with them
                  would jump on every step. Keyed on the index so it fades with the
                  photo it belongs to. */}
              <div className="gallery__foot">
                <p className="gallery__caption" key={shot}>
                  {slide.gallery.images[shot].caption}
                </p>
                <div className="gallery__dots" aria-hidden>
                  {slide.gallery.images.map((img, i) => (
                    <span
                      className={`gallery__dot${i === shot ? ' is-active' : ''}`}
                      key={img.src}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

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
                stepped && 'deck__kicker--step',
                kickerShown && 'is-shown',
              ]
                .filter(Boolean)
                .join(' ')}
              style={stepped ? undefined : { animationDelay: `${tailDelay + 200}ms` }}
            >
              {slide.kicker}
            </p>
          )}
          </>
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
