import type { Hotspot } from '../content/hotspots'

export function Progress({
  hotspots,
  activeIndex,
}: {
  hotspots: Hotspot[]
  activeIndex: number | null
}) {
  return (
    <div className="progress">
      {hotspots.map((h, i) => (
        <span key={h.id} className={i === activeIndex ? 'progress__tag is-active' : 'progress__tag'}>
          {h.tag}
        </span>
      ))}
    </div>
  )
}
