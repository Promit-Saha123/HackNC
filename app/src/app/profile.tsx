import { Text } from 'react-native';

import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { type as t } from '@/theme/fonts';

export default function ProfileScreen() {
  return (
    <Screen title="Profile" subtitle="Coming soon">
      <Card>
        <Text style={t.body}>Sleep goals, privacy toggles and connections land here.</Text>
      </Card>
    </Screen>
  );
}
