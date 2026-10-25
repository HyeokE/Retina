import { StyleSheet, Text, View } from 'react-native';
import { RetinaReadyMarker } from '../components/RetinaMarkers';
import { Button, Screen, colors } from '../components/ui';
import { useProfile } from '../hooks/profile';
import { ScreenStatus } from './ScreenStatus';

interface ProfileScreenProps {
  readonly onEdit: () => void;
}

export function ProfileScreen({ onEdit }: ProfileScreenProps) {
  const { state, reload } = useProfile();

  if (state.status === 'loading') return <ScreenStatus message="Loading profile…" />;
  if (state.status === 'error') return <ScreenStatus message={state.message} onRetry={reload} />;

  const { profile } = state;
  return (
    <Screen>
      <RetinaReadyMarker screen="profile" />
      <Text style={styles.title} accessibilityRole="header">
        Profile
      </Text>
      <DetailRow label="Name" value={profile.name} testID="profile-name" />
      <DetailRow label="Email" value={profile.email} testID="profile-email" />
      <DetailRow label="City" value={profile.city || '—'} testID="profile-city" />
      <Button label="Edit" variant="primary" onPress={onEdit} testID="edit-button" />
    </Screen>
  );
}

function DetailRow({ label, value, testID }: { label: string; value: string; testID: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} testID={testID}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  row: {
    gap: 2,
  },
  label: {
    fontSize: 14,
    color: colors.muted,
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
});
