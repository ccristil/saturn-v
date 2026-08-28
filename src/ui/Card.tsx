import type { Hotspot } from '../content/hotspots'

export function Card({ hotspot }: { hotspot: Hotspot | null }) {
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
        </>
      )}
    </aside>
  )
}
