import { Keyboard, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import type { Profile, ProfileField } from 'retina-example-shared';
import { RetinaReadyMarker } from '../components/RetinaMarkers';
import { Button, Screen, colors } from '../components/ui';
import { useEditProfileForm, useProfile } from '../hooks/profile';
import { ScreenStatus } from './ScreenStatus';

interface EditProfileScreenProps {
  readonly onDone: () => void;
  readonly onCancel: () => void;
}

export function EditProfileScreen({ onDone, onCancel }: EditProfileScreenProps) {
  const { state, reload } = useProfile();

  if (state.status === 'loading') return <ScreenStatus message="Loading profile…" />;
  if (state.status === 'error') return <ScreenStatus message={state.message} onRetry={reload} />;

  return <EditProfileForm initial={state.profile} onDone={onDone} onCancel={onCancel} />;
}

const FIELDS: ReadonlyArray<{
  field: ProfileField;
  label: string;
  inputProps: Pick<TextInputProps, 'keyboardType' | 'autoCapitalize' | 'autoComplete'>;
}> = [
  { field: 'name', label: 'Name', inputProps: { autoCapitalize: 'words', autoComplete: 'name' } },
  { field: 'email', label: 'Email', inputProps: { keyboardType: 'email-address', autoCapitalize: 'none', autoComplete: 'email' } },
  { field: 'city', label: 'City', inputProps: { autoCapitalize: 'words', autoComplete: 'off' } },
];

interface EditProfileFormProps {
  readonly initial: Profile;
  readonly onDone: () => void;
  readonly onCancel: () => void;
}

function EditProfileForm({ initial, onDone, onCancel }: EditProfileFormProps) {
  const form = useEditProfileForm(initial);

  const handleSave = async () => {
    // Close the keyboard first so the validation-error state is captured
    // with the same layout every time.
    Keyboard.dismiss();
    if (await form.submit()) onDone();
  };

  return (
    <Screen>
      <RetinaReadyMarker screen="edit" />
      <Text style={styles.title} accessibilityRole="header">
        Edit profile
      </Text>
      <View testID="edit-form" collapsable={false} style={styles.form}>
        {FIELDS.map(({ field, label, inputProps }) => {
          const error = form.fieldErrors[field];
          return (
            <View key={field} style={styles.field}>
              <Text style={styles.label}>{label}</Text>
              <TextInput
                testID={`field-${field}`}
                accessibilityLabel={label}
                value={form.values[field]}
                onChangeText={(value) => form.setField(field, value)}
                style={[styles.input, error ? styles.inputInvalid : null]}
                {...inputProps}
              />
              {error ? (
                <Text testID={`error-${field}`} style={styles.error} accessibilityRole="alert">
                  {error}
                </Text>
              ) : null}
            </View>
          );
        })}
        {form.submitError ? (
          <Text testID="submit-error" style={styles.error} accessibilityRole="alert">
            {form.submitError}
          </Text>
        ) : null}
      </View>
      <View style={styles.actions}>
        <Button label="Cancel" onPress={onCancel} disabled={form.saving} />
        <Button
          label={form.saving ? 'Saving…' : 'Save'}
          variant="primary"
          onPress={handleSave}
          disabled={form.saving}
          testID="save-button"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  form: {
    gap: 16,
  },
  field: {
    gap: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  input: {
    fontSize: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    color: colors.text,
  },
  inputInvalid: {
    borderColor: colors.error,
  },
  error: {
    fontSize: 14,
    color: colors.error,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 12,
  },
});
