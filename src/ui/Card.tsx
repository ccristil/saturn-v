import { useEffect, useState } from 'react'
import type { Hotspot } from '../content/hotspots'
import { Clip } from './Clip'

type Media = NonNullable<Hotspot['images']>[number] | NonNullable<Hotspot['clips']>[number]
const keyOf = (m: Media) => ('youtube' in m ? `${m.youtube}@${m.from}` : m.src)

export function Card({ hotspot, onHomecoming }: { hotspot: Hotspot | null; onHomecoming?: () => void }) {
  const [shot, setShot] = useState(0)

  // A new hotspot always opens on its first photo, never wherever the last one left off.
  useEffect(() => {
    setShot(0)
  }, [hotspot?.id])

  // Photos, then clips — one gallery, shown one at a time.
  const media: Media[] = [...(hotspot?.images ?? []), ...(hotspot?.clips ?? [])]
  const count = media.length
  // Video is 16:9: a gallery of nothing but clips takes that shape instead of the photos' 4:3.
  const wide = count > 0 && media.every((m) => 'youtube' in m)

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
          {count > 0 && (
            <div className="card__gallery">
              <div className={`card__gallery-stage${wide ? ' card__gallery-stage--wide' : ''}`}>
                {media.map((m, i) => (
                  <figure
                    className={`card__gallery-item${i === shot ? ' is-shown' : ''}`}
                    key={keyOf(m)}
                    aria-hidden={i !== shot}
                  >
                    {'youtube' in m ? (
                      <Clip clip={m} shown={i === shot} />
                    ) : (
                      <img
                        className="card__gallery-image"
                        src={import.meta.env.BASE_URL + m.src}
                        alt={m.alt}
                      />
                    )}
                  </figure>
                ))}
                {count > 1 && (
                  <>
                    <button
                      type="button"
                      className="card__gallery-nav card__gallery-nav--prev"
                      aria-label="Previous"
                      onClick={() => setShot((s) => (s - 1 + count) % count)}
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      className="card__gallery-nav card__gallery-nav--next"
                      aria-label="Next"
                      onClick={() => setShot((s) => (s + 1) % count)}
                    >
                      ›
                    </button>
                  </>
                )}
              </div>
              <div className="card__gallery-foot">
                <p className="card__gallery-credit">{media[shot]?.credit}</p>
                {count > 1 && (
                  <div className="card__gallery-dots">
                    {media.map((m, i) => (
                      <button
                        type="button"
                        key={keyOf(m)}
                        className={`card__gallery-dot${i === shot ? ' is-active' : ''}`}
                        aria-label={`Show ${i + 1} of ${count}`}
                        onClick={() => setShot(i)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          {hotspot.homecoming && onHomecoming && (
            <button type="button" className="hud-btn card__cta" onClick={onHomecoming}>
              {hotspot.homecoming}
            </button>
          )}
        </>
      )}
    </aside>
  )
}
