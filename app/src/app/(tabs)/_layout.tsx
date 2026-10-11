import { Redirect } from 'expo-router';

import AppTabs from '@/components/app-tabs';
import { useUser } from '@/state/user';

/** The five tabs, only reachable once signed in. */
export default function TabsLayout() {
  const { signedIn } = useUser();
  if (!signedIn) return <Redirect href="/login" />;
  return <AppTabs />;
}
