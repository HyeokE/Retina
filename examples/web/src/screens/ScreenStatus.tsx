interface ScreenStatusProps {
  readonly message: string
  readonly onRetry?: () => void
}

// Loading and error states never carry the Retina ready marker, so a capture
// cannot fire before the screen has its data.
export function ScreenStatus({ message, onRetry }: ScreenStatusProps) {
  return (
    <main className="screen" data-testid="screen-status">
      <p role={onRetry ? 'alert' : 'status'}>{message}</p>
      {onRetry ? (
        <button type="button" className="button" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </main>
  )
}
