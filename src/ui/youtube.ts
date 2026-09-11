// YouTube's IFrame Player API, shared by the card clips (Clip.tsx) and the HUD's full-screen
// launch video (LaunchVideo.tsx). Only the slice used is typed (an @types package isn't
// worth a dependency).

export type YTPlayer = {
  getCurrentTime(): number
  getDuration(): number
  getPlayerState(): number // -1 unstarted · 0 ended · 1 playing · 2 paused · 3 buffering · 5 cued
  getIframe(): HTMLIFrameElement
  playVideo(): void
  pauseVideo(): void
  unMute(): void
  setVolume(volume: number): void // 0–100
  setOption(module: string, option: string, value: unknown): void // ('captions', 'track', {}) = captions off
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
        onApiChange?: (e: YTEvent) => void // a module (captions) has loaded
      }
    },
  ) => YTPlayer
}

// YouTube's own player script, loaded once on first need. It comes from where the video
// itself comes from, so it adds no new way for a clip to fail.
let api: Promise<YTApi> | null = null
export function loadYouTube(): Promise<YTApi> {
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
