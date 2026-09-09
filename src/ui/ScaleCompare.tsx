import type { CSSProperties } from 'react'
import type { Scale, ScaleVehicle } from '../content/slides'

// To-scale vehicle silhouettes for a deck slide (slides.ts `scale`).
//
// Everything here is measured in METRES. Each silhouette is hand-authored at a known
// height (`h` below, nose at y=0, centreline at x=0) and then drawn at the height the
// content gives it — so `heightM` in slides.ts really does size the drawing, and the
// picture can't drift from the number printed beside it. Lane positions and the
// viewBox are packed from the scaled half-widths, so adding or resizing a vehicle
// re-lays-out the drawing rather than needing a magic width retyped by hand.
//
// The silhouettes themselves are geometry, so they live here rather than in content.

const GAP = 5 // metres of floor between vehicles

type ShapeDef = {
  h: number // the height these coordinates are authored at
  halfW: number // widest half-extent, for packing lanes
  body: string
  fins?: string
}

// Saturn V — 110.6 m tall, 10.1 m core, 18.3 m fin span. Bottom → top: S-IC and S-II
// share the 10.1 m core; taper to the 6.6 m S-IVB/IU; taper again through the
// spacecraft adapter to the 3.9 m service + command module; then the escape tower.
const SATURN_V: ShapeDef = {
  h: 110.6,
  halfW: 9.15,
  body: `
    M 5.05 110.6 L 5.05 46.6 L 3.3 42.6 L 3.3 26.6 L 1.95 18.6 L 1.95 11.6
    L 0.65 7.6 L 0.45 7.6 L 0.45 2.6 L 0.7 2.6 L 0.7 1 L 0 0
    L -0.7 1 L -0.7 2.6 L -0.45 2.6 L -0.45 7.6 L -0.65 7.6 L -1.95 11.6
    L -1.95 18.6 L -3.3 26.6 L -3.3 42.6 L -5.05 46.6 L -5.05 110.6 Z
  `,
  // the four base fins, as the two that show in profile
  fins: `
    M 5.05 110.6 L 9.15 110.6 L 5.05 102.6 Z
    M -5.05 110.6 L -9.15 110.6 L -5.05 102.6 Z
  `,
}

// Falcon 1 — 22.25 m tall, 1.68 m body, 3 m fairing.
const FALCON_1: ShapeDef = {
  h: 22.25,
  halfW: 0.84,
  body: `M 0.84 22.25 L 0.84 3 L 0 0 L -0.84 3 L -0.84 22.25 Z`,
}

const SHAPES: Record<ScaleVehicle['shape'], ShapeDef> = {
  'saturn-v': SATURN_V,
  'falcon-1': FALCON_1,
}

// "140,000 kg" reads as an abstraction at a glance; "140 t" is a number the room can
// hold. Anything under a tonne stays in kilograms, so a 670 kg payload isn't rounded
// away into nothing — which would quietly flatter the smaller vehicle.
function payload(kg: number) {
  return kg >= 1000 ? `${(kg / 1000).toLocaleString()} t` : `${kg.toLocaleString()} kg`
}

export function ScaleCompare({
  scale,
  stepped = false,
  shown = true,
}: {
  scale: Scale
  stepped?: boolean // this panel is a presenter beat rather than part of the slide
  shown?: boolean
}) {
  const ground = Math.max(...scale.vehicles.map((v) => v.heightM))
  const [a, b] = scale.vehicles

  // Pack the lanes left → right from each vehicle's drawn half-width, and let the
  // total set the viewBox — so the drawing is exactly as wide as it needs to be.
  let x = 0
  const lanes = scale.vehicles.map((v) => {
    const shape = SHAPES[v.shape]
    const k = v.heightM / shape.h
    const half = shape.halfW * k
    const cx = x + half
    x = cx + half + GAP
    return { v, shape, k, cx }
  })
  const width = x - GAP

  return (
    <div
      className={['scale', stepped && 'scale--step', stepped && shown && 'is-shown']
        .filter(Boolean)
        .join(' ')}
    >
      {scale.eyebrow && <div className="scale__eyebrow">{scale.eyebrow}</div>}

      <div className="scale__stage">
        <svg
          className="scale__svg"
          viewBox={`0 0 ${width} ${ground}`}
          role="img"
          aria-label={scale.vehicles
            .map((v) => `${v.name}, ${v.heightM} metres, ${payload(v.payloadKg)} to orbit`)
            .join('; ')}
        >
          {lanes.map(({ v, shape, k, cx }) => (
            // Sit each vehicle's base on the ground line and scale it to its real
            // height. Uniform scale, so the profile keeps its proportions.
            <g
              key={v.name}
              className={`scale__body${v.accent ? ' scale__body--accent' : ''}`}
              transform={`translate(${cx} ${ground - v.heightM}) scale(${k})`}
            >
              <path d={shape.body} />
              {shape.fins && <path d={shape.fins} />}
            </g>
          ))}
          <line className="scale__ground" x1="0" y1={ground} x2={width} y2={ground} />
        </svg>

        {/* Labels get their own column and are placed by height, so each one sits
            level with the nose of the vehicle it names. */}
        <div className="scale__tags">
          {scale.vehicles.map((v) => (
            <div
              className={`scale__tag${v.accent ? ' scale__tag--accent' : ''}`}
              key={v.name}
              style={{ '--top': `${(1 - v.heightM / ground) * 100}%` } as CSSProperties}
            >
              <div className="scale__name">{v.name}</div>
              <div className="scale__h">{v.heightM} m</div>
              <div className="scale__p">{payload(v.payloadKg)} to orbit</div>
            </div>
          ))}
        </div>
      </div>

      {/* Both multiples are computed from the heights and payloads above, so the
          headline figures and the drawing can never disagree. */}
      {b && (
        <div className="scale__ratios">
          <div className="scale__ratio">
            <b>{Math.round(a.heightM / b.heightM)}×</b>
            <span>taller</span>
          </div>
          <div className="scale__ratio">
            <b>{Math.round(a.payloadKg / b.payloadKg)}×</b>
            <span>the payload</span>
          </div>
        </div>
      )}
    </div>
  )
}
