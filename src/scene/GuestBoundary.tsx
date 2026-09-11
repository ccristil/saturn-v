import { Component, Suspense, type ReactNode } from 'react'

// The two boundaries every optional guest model (the comparison vehicles, the spacecraft)
// is mounted inside. Suspense, so a model that isn't warm yet can't blank the Saturn V while
// it loads. And an error boundary: a missing or unreadable file makes the loader throw, and
// with nothing to catch it R3F rethrows to the DOM root — the whole app unmounts mid-talk,
// keyboard and all. This drops just that guest and logs it.
class SkipOnError extends Component<{ name: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(e: unknown) {
    // eslint-disable-next-line no-console
    console.error(`[${this.props.name}] failed to load — skipped`, e)
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

export function GuestBoundary({ name, children }: { name: string; children: ReactNode }) {
  return (
    <SkipOnError name={name}>
      <Suspense fallback={null}>{children}</Suspense>
    </SkipOnError>
  )
}
