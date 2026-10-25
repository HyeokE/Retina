import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RetinaBuildId } from './components/RetinaMarkers';
import { useAppRoute } from './hooks/useAppRoute';
import { EditProfileScreen } from './screens/EditProfileScreen';
import { ProfileScreen } from './screens/ProfileScreen';

export default function App() {
  const { route, entryKey, navigate } = useAppRoute();
  const goToProfile = () => navigate('profile');

  return (
    <SafeAreaProvider>
      {route === 'edit' ? (
        <EditProfileScreen key={entryKey} onDone={goToProfile} onCancel={goToProfile} />
      ) : (
        <ProfileScreen key={entryKey} onEdit={() => navigate('edit')} />
      )}
      <RetinaBuildId />
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
