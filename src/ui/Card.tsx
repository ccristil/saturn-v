import { useEffect, useState } from 'react'
import type { Hotspot } from '../content/hotspots'

export function Card({ hotspot }: { hotspot: Hotspot | null }) {
  const [shot, setShot] = useState(0)

  // A new hotspot always opens on its first photo, never wherever the last one left off.
  useEffect(() => {
    setShot(0)
  }, [hotspot?.id])

  const images = hotspot?.images
  const count = images?.length ?? 0

  return (
    <aside className={hotspot ? 'card card--open' : 'card'} aria-hidden={hotspot === null}>
      {hotspot && (
        <>
          <div className="card__tag">{hotspot.tag}</div>
          <h2 className="card__title">{hotspot.title}</h2>
          <p className="card__subtitle">{hotspot.subtitle}</p>
          {hotspot.body.map((para, i) => (
            <p className="card__body" key={i}>
              {para}
            </p>
          ))}
          {hotspot.specs && (
            <dl className="card__specs">
              {hotspot.specs.map((s) => (
                <div className="card__spec" key={s.label}>
                  <dt>{s.label}</dt>
                  <dd>{s.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {images && count > 0 && (
            <div className="card__gallery">
              <div className="card__gallery-stage">
                {images.map((img, i) => (
                  <figure
                    className={`card__gallery-item${i === shot ? ' is-shown' : ''}`}
                    key={img.src}
                    aria-hidden={i !== shot}
                  >
                    <img
                      className="card__gallery-image"
                      src={import.meta.env.BASE_URL + img.src}
                      alt={img.alt}
                    />
                  </figure>
                ))}
                {count > 1 && (
                  <>
                    <button
                      type="button"
                      className="card__gallery-nav card__gallery-nav--prev"
                      aria-label="Previous photo"
                      onClick={() => setShot((s) => (s - 1 + count) % count)}
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      className="card__gallery-nav card__gallery-nav--next"
                      aria-label="Next photo"
                      onClick={() => setShot((s) => (s + 1) % count)}
                    >
                      ›
                    </button>
                  </>
                )}
              </div>
              <div className="card__gallery-foot">
                <p className="card__gallery-credit">{images[shot].credit}</p>
                {count > 1 && (
                  <div className="card__gallery-dots">
                    {images.map((img, i) => (
                      <button
                        type="button"
                        key={img.src}
                        className={`card__gallery-dot${i === shot ? ' is-active' : ''}`}
                        aria-label={`Show photo ${i + 1}`}
                        onClick={() => setShot(i)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </aside>
  )
}
