import type { Slide } from '../content/slides'

// Fullscreen slide deck overlay. Keyboard nav is owned by App; this also allows
// click-the-slide-to-advance (touch-friendly) plus explicit footer/exit controls.
export function Presentation({
  slides,
  index,
  exiting = false,
  onNext,
  onPrev,
  onExit,
}: {
  slides: Slide[]
  index: number
  exiting?: boolean
  onNext: () => void
  onPrev: () => void
  onExit: () => void
}) {
  const slide = slides[index]
  const atStart = index === 0

  return (
    <div className={exiting ? 'deck deck--exiting' : 'deck'}>
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
      </div>

      <div className="deck__footer">
        <button className="deck__nav" onClick={onPrev} disabled={atStart}>
          ← Prev
        </button>
        <span className="deck__counter">
          {String(index + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
        </span>
        <button className="deck__nav" onClick={onNext}>
          Next →
        </button>
      </div>
    </div>
  )
}
