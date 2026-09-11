import { useEffect, useRef, useState } from 'react'
import type { Clip as ClipData } from '../content/hotspots'

// One snippet of a YouTube video, played inside the card on click (hotspot.clips). Until
// then it's YouTube's thumbnail and nothing else loads. The footage is silent, so the
// player runs muted, which every browser lets start without asking.
//
// Kept presentation-safe:
//  - The player never takes a click or focus (pointer-events none, tabIndex -1). A click
//    inside a YouTube iframe moves focus into it, and then ←/→ stop reaching the app, so
//    our own button over it starts and stops the clip instead.
//  - YouTube draws its own chrome (title bar, a centre pause icon, "More videos", its
//    logo) over the first ~4 s of any playback, and again after every seek, pause or
//    resume. So the player starts up to PREROLL_S early, hidden under the poster, and the
//    poster lifts when it reaches `from`, by which time the chrome has faded. A clip that
//    starts near 0:00 has no room before it, so its opening seconds still show the chrome.
//  - The poster fades back in just before `to`, so YouTube's end screen (a grid of
//    suggested videos) never shows either. Click again to replay.
//  - A second click while it's starting is ignored, so a double-click can't cancel it.
//  - Paging to another photo or clip, another hotspot, or closing the card tears it down.
//  - If YouTube can't be reached the poster says so, and a click retries.
//  - "Full screen" puts the clip element itself in the browser's full screen: the top
//    layer, so it escapes the card's transform and clipping, and the player is never
//    re-mounted, paused or seeked (each would bring YouTube's chrome back). It starts an
//    idle clip too, so it's one click. Esc leaves full screen and stops there instead of
//    also closing the card; ←/→ still step hotspots, which tears it all down.

const PREROLL_S = 4
// How early to start fading the poster back in before `to`, and how long that fade takes
// (matches .clip__poster's transition).
const LEAD_S = 0.5
const FADE_MS = 320

// Corner-bracket icons for the full-screen button: pointing out to grow, in to shrink.
const GROW = 'M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4'
const SHRINK = 'M6 2v4H2M14 6h-4V2M10 14v-4h4M2 10h4v4'

// "1:35" → 95
const seconds = (t: string) => t.split(':').reduce((s, n) => s * 60 + Number(n), 0)

// 20 → "0:20"
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

// The slice of YouTube's IFrame Player API used here (an @types package isn't worth a dependency).
type YTPlayer = {
  getCurrentTime(): number
  getPlayerState(): number // 1 = playing
  getIframe(): HTMLIFrameElement
  destroy(): void
}
type YTEvent = { target: YTPlayer; data: number }
type YTApi = {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string
      width: string
      height: string
      playerVars: Record<string, number>
      events: {
        onReady: (e: YTEvent) => void
        onStateChange: (e: YTEvent) => void
        onError: (e: YTEvent) => void
      }
    },
  ) => YTPlayer
}

// YouTube's own player script, loaded once on first need. It comes from where the video
// itself comes from, so it adds no new way for a clip to fail.
let api: Promise<YTApi> | null = null
function loadYouTube(): Promise<YTApi> {
  api ??= new Promise((resolve, reject) => {
    const w = window as unknown as {
      YT?: YTApi & { ready?: (f: () => void) => void }
      onYouTubeIframeAPIReady?: () => void
    }
    // Already on the page: a hot-reloaded copy of this module starts over with `api` null,
    // and YouTube's loader never calls onYouTubeIframeAPIReady a second time, so the clip
    // would spin forever. YT.ready runs now if the API is up, or as soon as it is.
    if (w.YT?.ready) {
      w.YT.ready(() => resolve(w.YT!))
      return
    }
    w.onYouTubeIframeAPIReady = () => resolve(w.YT!)
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.onerror = () => {
      script.remove()
      api = null // the next click tries again
      reject(new Error('could not load the YouTube player API'))
    }
    document.head.appendChild(script)
  })
  return api
}

// idle: the poster · loading: poster + spinner, the player starting (and pre-rolling)
// underneath · live: poster faded out · ending: poster fading back in over the last frames
type Phase = 'idle' | 'loading' | 'live' | 'ending'

export function Clip({ clip, shown }: { clip: ClipData; shown: boolean }) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [failed, setFailed] = useState(false)
  const [full, setFull] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const host = useRef<HTMLDivElement>(null)
  const stop = useRef(() => setPhase('idle'))
  const on = phase !== 'idle'

  const start = seconds(clip.from)
  const end = seconds(clip.to)

  // Fetch the API as soon as the clip is in a card, so a click only waits on the video.
  useEffect(() => {
    loadYouTube().catch(() => {})
  }, [])

  // Paging away stops it; paging back shows the poster, not a video resuming mid-way.
  useEffect(() => {
    if (!shown) setPhase('idle')
  }, [shown])

  // However full screen ends (our button, Esc, the browser's own exit), follow it.
  useEffect(() => {
    const sync = () => setFull(document.fullscreenElement === box.current)
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  // Esc leaves full screen and stops there. Caught before App's handler (capture phase),
  // which would otherwise close the card underneath on the same keystroke.
  useEffect(() => {
    if (!full) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      document.exitFullscreen().catch(() => {})
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [full])

  useEffect(() => {
    const el = host.current
    if (!on || !shown || !el) return
    let player: YTPlayer | null = null
    let ready = false
    let revealed = false
    let over = false // finishing: the poster is fading back in
    let gone = false // torn down: ignore anything still in flight
    let poll = 0
    let fade = 0

    // Fade the poster in over the clip's last moments, then drop the player.
    const finish = () => {
      if (over || gone) return
      over = true
      setPhase('ending')
      fade = window.setTimeout(() => setPhase('idle'), FADE_MS)
    }
    stop.current = finish

    const fail = (why: unknown) => {
      if (gone) return
      console.warn(`[clip] ${clip.youtube} ${clip.from}–${clip.to} didn't play:`, why)
      setFailed(true)
      finish()
    }

    loadYouTube().then((YT) => {
      if (gone) return
      player = new YT.Player(el.appendChild(document.createElement('div')), {
        videoId: clip.youtube,
        width: '100%',
        height: '100%',
        playerVars: {
          start: Math.max(0, start - PREROLL_S),
          end, // a backstop — the poll below fades out before YouTube stops here
          autoplay: 1,
          mute: 1,
          playsinline: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          iv_load_policy: 3,
        },
        events: {
          onReady: (e) => {
            ready = true
            e.target.getIframe().tabIndex = -1
          },
          // 0 = ended, in case the poll was throttled and missed the fade
          onStateChange: (e) => {
            if (e.data === 0) finish()
          },
          onError: (e) => fail(`player error ${e.data}`),
        },
      })
      poll = window.setInterval(() => {
        if (!ready) return
        const t = player!.getCurrentTime()
        // Lift the poster a touch early so its fade is done right at `from`.
        if (!revealed && t >= start - 0.15 && player!.getPlayerState() === 1) {
          revealed = true
          setPhase((p) => (p === 'loading' ? 'live' : p))
        }
        if (t >= end - LEAD_S) finish()
      }, 100)
    }, fail)

    return () => {
      gone = true
      window.clearInterval(poll)
      window.clearTimeout(fade)
      player?.destroy()
      el.replaceChildren()
      stop.current = () => setPhase('idle')
    }
  }, [on, shown, clip, start, end])

  const click = () => {
    if (phase === 'idle') {
      setFailed(false)
      setPhase('loading')
    } else if (phase === 'live') stop.current()
  }

  const toggleFull = () => {
    if (full) {
      document.exitFullscreen().catch(() => {})
      return
    }
    box.current?.requestFullscreen().catch((why) => console.warn('[clip] full screen refused:', why))
    // One click fills the screen and starts it; a clip already under way just carries on.
    if (phase === 'idle') {
      setFailed(false)
      setPhase('loading')
    }
  }

  return (
    <div className={`clip${phase === 'live' ? ' clip--live' : ''}`} ref={box}>
      <div className="clip__player" ref={host} />
      <button
        type="button"
        className="clip__hit"
        aria-label={`${phase === 'live' ? 'Stop' : 'Play'}: ${clip.label}`}
        onClick={click}
      >
        <span
          className="clip__poster"
          style={{ backgroundImage: `url(https://i.ytimg.com/vi/${clip.youtube}/maxresdefault.jpg)` }}
        >
          <span className={`clip__play${phase === 'loading' ? ' is-loading' : ''}`} />
          <span className="clip__caption">
            <span className="clip__label">
              {failed ? 'Couldn’t load the clip — click to retry' : clip.label}
            </span>
            <span className="clip__length">{clock(end - start)}</span>
          </span>
        </span>
      </button>
      <button
        type="button"
        className="clip__full"
        aria-label={full ? 'Exit full screen' : `Full screen: ${clip.label}`}
        onClick={toggleFull}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d={full ? SHRINK : GROW} />
        </svg>
        {full ? 'Exit full screen' : 'Full screen'}
      </button>
    </div>
  )
}
