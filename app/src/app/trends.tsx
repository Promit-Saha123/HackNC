import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Text } from 'react-native';
import { type as t } from '@/theme/fonts';

export default function TrendsScreen() {
  return (
    <Screen title="Sleep journey" subtitle="Coming soon">
      <Card>
        <Text style={t.body}>Charts for score, time in bed and bedtime land here.</Text>
      </Card>
    </Screen>
  );
}
