import { useRoute } from './hooks/useRoute.ts'
import { EditProfileScreen } from './screens/EditProfileScreen.tsx'
import { ProfileScreen } from './screens/ProfileScreen.tsx'

export default function App() {
  const { route, navigate } = useRoute()

  return route === 'edit' ? (
    <EditProfileScreen onDone={() => navigate('profile')} onCancel={() => navigate('profile')} />
  ) : (
    <ProfileScreen onEdit={() => navigate('edit')} />
  )
}
