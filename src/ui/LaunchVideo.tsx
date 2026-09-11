import { useEffect, useRef, useState } from 'react'
import { loadYouTube, type YTPlayer } from './youtube'
import type { LaunchVideo as LaunchVideoData } from '../content/hotspots'

// The HUD's "Launch video": one whole YouTube video, full screen and with sound. The card
// clips (Clip.tsx) are silent snippets; this is the launch with its audio, for the room.
// The click on the HUD button is what lets it take the screen and play unmuted.
//
// Kept presentation-safe:
//  - While it's up it owns the keyboard: Esc closes it, Space pauses, and every other key
//    is swallowed, so nothing in the scene can change unseen behind it. Closing it leaves
//    you exactly where you were.
//  - Leaving full screen any other way (the browser's own exit) closes it too. If the
//    browser refuses full screen, the overlay still fills the window.
//  - The player never takes a click or focus (pointer-events none, tabIndex -1), so the
//    keyboard stays with the app. A click anywhere on the video pauses and resumes it.
//  - It closes itself at the end, fading to black just before YouTube's end screen (a grid
//    of suggested videos) can show.
//  - The pointer and the Close pill fade out once the mouse has been still for a moment,
//    so the room sees only the footage.
//  - If YouTube can't be reached it says so, and Esc still gets you out.
//  - It stays mounted and opens on `open`, rather than mounting on open, so StrictMode's
//    double mount can't ask for full screen twice.

const LEAD_S = 0.5 // start fading to black this long before the end...
const FADE_MS = 320 // ...over this long (matches .launch__cover's transition)
const IDLE_MS = 2500 // the pointer + Close pill hide after this long without the mouse moving
const STALL_MS = 5000 // ready but still not playing after this long: offer a click to play

// loading: poster + spinner, the player starting underneath · stalled: the browser held
// autoplay back, so the poster shows a play button · live: the footage · ending: fading to
// black before it closes · failed: the poster says so
type Phase = 'loading' | 'stalled' | 'live' | 'ending' | 'failed'

const toggle = (p: YTPlayer | null) => {
  if (!p) return
  if (p.getPlayerState() === 1) p.pauseVideo()
  else p.playVideo()
}

export function LaunchVideo({
  video,
  open,
  onClose,
}: {
  video: LaunchVideoData
  open: boolean
  onClose: () => void
}) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [paused, setPaused] = useState(false)
  const [idle, setIdle] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const host = useRef<HTMLDivElement>(null)
  const player = useRef<YTPlayer | null>(null)
  const close = useRef(onClose)
  close.current = onClose

  // Take the screen. However full screen ends (Esc, the browser's own exit), close with it.
  useEffect(() => {
    const el = box.current
    if (!open || !el) return
    let entered = false
    const sync = () => {
      if (document.fullscreenElement === el) entered = true
      else if (entered) close.current()
    }
    document.addEventListener('fullscreenchange', sync)
    el.requestFullscreen().catch((why) => console.warn('[launch] full screen refused:', why))
    return () => {
      document.removeEventListener('fullscreenchange', sync)
      if (document.fullscreenElement === el) document.exitFullscreen().catch(() => {})
    }
  }, [open])

  // Owns the keyboard while it's up: capture phase, so App's own handler never hears it.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return // browser shortcuts, as in App
      e.stopPropagation()
      if (e.key === 'Escape') close.current()
      else if (e.key === ' ') {
        e.preventDefault()
        toggle(player.current)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open])

  // Hide the pointer and the Close pill once the mouse has been still for a moment.
  useEffect(() => {
    const el = box.current
    if (!open || !el) return
    let t = 0
    const wake = () => {
      setIdle(false)
      window.clearTimeout(t)
      t = window.setTimeout(() => setIdle(true), IDLE_MS)
    }
    wake()
    el.addEventListener('mousemove', wake)
    return () => {
      el.removeEventListener('mousemove', wake)
      window.clearTimeout(t)
      setIdle(false)
    }
  }, [open])

  useEffect(() => {
    const el = host.current
    if (!open || !el) return
    let p: YTPlayer | null = null
    let over = false // finishing: fading to black
    let gone = false // torn down: ignore anything still in flight
    let poll = 0
    let fade = 0
    let stall = 0

    const finish = () => {
      if (over || gone) return
      over = true
      setPhase('ending')
      fade = window.setTimeout(() => close.current(), FADE_MS)
    }

    const fail = (why: unknown) => {
      if (gone) return
      console.warn(`[launch] ${video.youtube} didn't play:`, why)
      setPhase('failed')
    }

    loadYouTube().then((YT) => {
      if (gone) return
      p = new YT.Player(el.appendChild(document.createElement('div')), {
        videoId: video.youtube,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 1,
          playsinline: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          iv_load_policy: 3,
        },
        events: {
          onReady: (e) => {
            player.current = e.target
            e.target.getIframe().tabIndex = -1
            // Unmuted, at full volume: the room's speakers set the level, not whatever
            // YouTube last remembered in this browser.
            e.target.unMute()
            e.target.setVolume(100)
            stall = window.setTimeout(
              () => setPhase((ph) => (ph === 'loading' ? 'stalled' : ph)),
              STALL_MS,
            )
          },
          onStateChange: (e) => {
            if (e.data === 1) {
              window.clearTimeout(stall)
              e.target.setOption('captions', 'track', {}) // captions off — see onApiChange
              setPhase((ph) => (ph === 'loading' || ph === 'stalled' ? 'live' : ph))
            }
            setPaused(e.data === 2)
            if (e.data === 0) finish() // in case the poll was throttled and missed the fade
          },
          onError: (e) => fail(`player error ${e.data}`),
          // The video carries YouTube's auto-generated captions, and the player turns them on
          // by default, over the footage. Selecting no track turns them off: here, as the
          // captions module loads just before playback, and again whenever playback starts.
          // (Unloading the module here doesn't hold — it's back as the video starts. Measured.)
          onApiChange: (e) => e.target.setOption('captions', 'track', {}),
        },
      })
      poll = window.setInterval(() => {
        const d = player.current?.getDuration() ?? 0
        if (d > 0 && player.current!.getCurrentTime() >= d - LEAD_S) finish()
      }, 100)
    }, fail)

    return () => {
      gone = true
      window.clearInterval(poll)
      window.clearTimeout(fade)
      window.clearTimeout(stall)
      p?.destroy()
      player.current = null
      el.replaceChildren()
      setPhase('loading')
      setPaused(false)
    }
  }, [open, video.youtube])

  if (!open) return null
  const poster = phase === 'loading' || phase === 'stalled' || phase === 'failed'
  const quiet = idle && phase === 'live' && !paused
  return (
    <div
      ref={box}
      className={`launch${phase === 'live' ? ' launch--live' : ''}${quiet ? ' launch--idle' : ''}`}
      role="dialog"
      aria-label={video.label}
    >
      <div className="launch__player" ref={host} />
      <div
        className="launch__cover"
        style={
          poster
            ? { backgroundImage: `url(https://i.ytimg.com/vi/${video.youtube}/maxresdefault.jpg)` }
            : undefined
        }
      >
        {phase === 'loading' && <span className="clip__play is-loading" />}
        {phase === 'stalled' && <span className="clip__play" />}
        {phase === 'failed' && (
          <p className="launch__note">Couldn’t load the video — Esc to go back</p>
        )}
        {poster && (
          <span className="launch__caption">
            {video.label}
            <span className="launch__credit">{video.credit}</span>
          </span>
        )}
      </div>
      {/* over the player: a click pauses or resumes — or starts it, if autoplay was held back */}
      <div className="launch__hit" onClick={() => toggle(player.current)} />
      <button type="button" className="launch__close" onClick={() => close.current()}>
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
        </svg>
        Close
      </button>
    </div>
  )
}
