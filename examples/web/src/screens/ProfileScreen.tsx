import { useProfile } from '../hooks/profile.ts'
import { retinaReadyAttributes } from './retina-markers.ts'
import { ScreenStatus } from './ScreenStatus.tsx'

interface ProfileScreenProps {
  readonly onEdit: () => void
}

export function ProfileScreen({ onEdit }: ProfileScreenProps) {
  const { state, reload } = useProfile()

  if (state.status === 'loading') return <ScreenStatus message="Loading profile…" />
  if (state.status === 'error') return <ScreenStatus message={state.message} onRetry={reload} />

  const { profile } = state
  return (
    <main className="screen" {...retinaReadyAttributes('profile')}>
      <h1>Profile</h1>
      <dl className="details">
        <dt>Name</dt>
        <dd data-testid="profile-name">{profile.name}</dd>
        <dt>Email</dt>
        <dd data-testid="profile-email">{profile.email}</dd>
        <dt>City</dt>
        <dd data-testid="profile-city">{profile.city || '—'}</dd>
      </dl>
      <button type="button" className="button button-primary" data-testid="edit-button" onClick={onEdit}>
        Edit
      </button>
    </main>
  )
}
