import type { FormEvent } from 'react'
import type { Profile, ProfileField } from 'retina-example-shared'
import { useEditProfileForm, useProfile } from '../hooks/profile.ts'
import { retinaReadyAttributes } from './retina-markers.ts'
import { ScreenStatus } from './ScreenStatus.tsx'

interface EditProfileScreenProps {
  readonly onDone: () => void
  readonly onCancel: () => void
}

export function EditProfileScreen({ onDone, onCancel }: EditProfileScreenProps) {
  const { state, reload } = useProfile()

  if (state.status === 'loading') return <ScreenStatus message="Loading profile…" />
  if (state.status === 'error') return <ScreenStatus message={state.message} onRetry={reload} />

  return <EditProfileForm initial={state.profile} onDone={onDone} onCancel={onCancel} />
}

interface EditProfileFormProps {
  readonly initial: Profile
  readonly onDone: () => void
  readonly onCancel: () => void
}

const FIELDS: ReadonlyArray<{ field: ProfileField; label: string; type: string; autoComplete: string }> = [
  { field: 'name', label: 'Name', type: 'text', autoComplete: 'name' },
  { field: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
  { field: 'city', label: 'City', type: 'text', autoComplete: 'address-level2' },
]

function EditProfileForm({ initial, onDone, onCancel }: EditProfileFormProps) {
  const form = useEditProfileForm(initial)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (await form.submit()) onDone()
  }

  return (
    <main className="screen" {...retinaReadyAttributes('edit')}>
      <h1>Edit profile</h1>
      {/* noValidate: the app shows its own inline errors instead of browser bubbles. */}
      <form className="form" data-testid="edit-form" noValidate onSubmit={handleSubmit}>
        {FIELDS.map(({ field, label, type, autoComplete }) => {
          const error = form.fieldErrors[field]
          const errorId = `error-${field}`
          return (
            <div className="field" key={field}>
              <label htmlFor={`field-${field}`}>{label}</label>
              <input
                id={`field-${field}`}
                data-testid={`field-${field}`}
                name={field}
                type={type}
                autoComplete={autoComplete}
                value={form.values[field]}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                onChange={(event) => form.setField(field, event.target.value)}
              />
              {error ? (
                <p className="field-error" id={errorId} data-testid={errorId} role="alert">
                  {error}
                </p>
              ) : null}
            </div>
          )
        })}
        {form.submitError ? (
          <p className="field-error" data-testid="submit-error" role="alert">
            {form.submitError}
          </p>
        ) : null}
        <div className="actions">
          <button type="button" className="button" onClick={onCancel} disabled={form.saving}>
            Cancel
          </button>
          <button type="submit" className="button button-primary" data-testid="save-button" disabled={form.saving}>
            {form.saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </main>
  )
}
