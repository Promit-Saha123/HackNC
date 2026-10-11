import { Text } from 'react-native';

import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { type as t } from '@/theme/fonts';

export default function AchievementsScreen() {
  return (
    <Screen title="Achievements" subtitle="Coming soon">
      <Card>
        <Text style={t.body}>Streak progress and the Moon, Cloud, Rainbow and Aurora badges land here.</Text>
      </Card>
    </Screen>
  );
}
