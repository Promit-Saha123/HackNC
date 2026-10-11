import { router } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useState, type ReactNode } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Card, Divider } from '@/components/Card';
import { IconCircle } from '@/components/IconCircle';
import { Screen, Section } from '@/components/Screen';
import { InfoSheet, type Info } from '@/components/sheets/InfoSheet';
import { LogSleepSheet } from '@/components/sheets/LogSleepSheet';
import { SquadSheet } from '@/components/sheets/SquadSheet';
import { TargetsSheet } from '@/components/sheets/TargetsSheet';
import { useOverview } from '@/hooks/use-overview';
import { usePrefs } from '@/state/prefs';
import { useSky } from '@/state/sky';
import { useUser } from '@/state/user';
import { Stepper } from '@/components/Stepper';
import { colors } from '@/theme/colors';
import { fontFamily, type as t } from '@/theme/fonts';
import { spacing } from '@/theme/spacing';
import { badgeStates } from '@/utils/badges';
import { clockFromMinutes } from '@/utils/format';

type SheetKey = 'targets' | 'squad' | 'log';

export default function ProfileScreen() {
  const { overview, error, refreshing, refresh } = useOverview();
  const { goals, squad } = usePrefs();
  const { signOut } = useUser();
  const sky = useSky();
  const [sheet, setSheet] = useState<SheetKey | null>(null);
  const [info, setInfo] = useState<Info | null>(null);
  // TODO(P1): persist these on the backend; local only for now.
  const [shareDetails, setShareDetails] = useState(true);
  const [showOnBoard, setShowOnBoard] = useState(true);

  const user = overview?.user;
  const squadName = squad?.name ?? user?.squad ?? null;
  const history = overview?.history ?? [];
  const avg = history.length ? Math.round(history.reduce((s, h) => s + h.score, 0) / history.length) : null;
  const streak = overview?.streak_days ?? 0;
  const badgeCount = badgeStates(streak, overview?.badge).filter((b) => b.unlocked).length;
  const close = () => setSheet(null);

  const confirmDelete = () =>
    Alert.alert('Delete my data?', 'This removes all of your sleep nights and scores. It cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        // TODO(P1/P2): call the delete endpoint once it exists.
        onPress: () => Alert.alert('Not connected yet', 'Deleting will work once the server endpoint is ready.'),
      },
    ]);

  return (
    <Screen title="Profile" refreshing={refreshing} onRefresh={refresh}>
      {error && <Text style={styles.error}>Can&apos;t reach the backend: {error}</Text>}

      <View style={styles.header}>
        <Avatar name={user?.name ?? '?'} size={96} />
        <Text style={styles.name}>{user?.name ?? ' '}</Text>
        {user?.is_demo && (
          <Pressable
            onPress={() =>
              setInfo({
                title: 'Demo profile',
                body: [
                  'This account and the friends on the leaderboard are synthetic demo profiles, so you can try Somni without real sleep data.',
                ],
              })
            }>
            <View style={styles.demoPill}>
              <Text style={styles.demoText}>Demo profile</Text>
            </View>
          </Pressable>
        )}
        <Text style={t.body}>{squadName ? `Squad: ${squadName}` : 'No squad yet'}</Text>
      </View>

      <Card padding={0}>
        <View style={styles.stats}>
          <Stat
            icon="moon.fill"
            value={String(streak)}
            label="Streak"
            onPress={() =>
              setInfo({
                title: `${streak}-night streak`,
                body: ['A night counts if you sleep 7 hours or more and go to bed within 1 hour of your usual bedtime.'],
              })
            }
          />
          <View style={styles.vline} />
          <Stat
            value={avg == null ? '--' : `${avg}%`}
            label="Avg score"
            onPress={() =>
              setInfo({
                title: 'Average score',
                subtitle: avg == null ? undefined : `${avg}% over your last ${history.length} nights`,
                body: [
                  'Each night scores 0 to 100: 40% duration, 30% bedtime consistency, 20% sleep quality and 10% streak.',
                  'It rewards steady, healthy sleep, not the most hours.',
                ],
              })
            }
          />
          <View style={styles.vline} />
          <Stat icon="star.fill" value={String(badgeCount)} label="Badges" onPress={() => router.navigate('/achievements')} />
        </View>
      </Card>

      <Section title="Sleep goals">
        <Card padding={0}>
          <Row
            icon={<IconCircle name="bed.double.fill" />}
            title="Target bedtime"
            detail={clockFromMinutes(goals.bedtime)}
            onPress={() => setSheet('targets')}
          />
          <Divider />
          <Row
            icon={<IconCircle name="sun.max.fill" />}
            title="Target wake time"
            detail={clockFromMinutes(goals.wake)}
            onPress={() => setSheet('targets')}
          />
          <Divider />
          <Row
            icon={<IconCircle name="clock.fill" />}
            title="Target sleep"
            detail={`${goals.hours} hours`}
            onPress={() => setSheet('targets')}
          />
          <Divider />
          <Row icon={<IconCircle name="plus" />} title="Log a night" detail="Enter bedtime and wake time" onPress={() => setSheet('log')} />
        </Card>
      </Section>

      <Section title="Squad">
        <Card padding={0}>
          <Row
            icon={<IconCircle name="person.3.fill" />}
            title={squadName ?? 'Join a squad'}
            detail={squadName ? 'Tap to see your invite code or switch' : 'Enter an invite code or create one'}
            onPress={() => setSheet('squad')}
          />
        </Card>
      </Section>

      <Section title="Privacy">
        <Card padding={0}>
          <Row
            icon={<IconCircle name="person.2.fill" />}
            title="Share details with friends"
            detail="Bedtime and hours on your friend card"
            right={<Toggle value={shareDetails} onChange={setShareDetails} />}
          />
          <Divider />
          <Row
            icon={<IconCircle name="trophy.fill" />}
            title="Show me on leaderboard"
            detail="Friends always see score and streak only"
            right={<Toggle value={showOnBoard} onChange={setShowOnBoard} />}
          />
        </Card>
      </Section>

      <Section title="Sky">
        <Card padding={0}>
          <Row
            icon={<IconCircle name={sky.daylight > 0.5 ? 'sun.max.fill' : 'moon.stars.fill'} />}
            title="Follow my clock"
            detail={sky.preview == null ? 'The sky changes with the time of day' : 'Previewing a different time'}
            right={<Toggle value={sky.preview == null} onChange={(on) => sky.setPreview(on ? null : Math.floor(sky.hour * 2) / 2)} />}
          />
          {sky.preview != null && (
            <>
              <Divider />
              <View style={styles.stepper}>
                <Stepper
                  label="Preview time"
                  value={sky.preview}
                  step={0.5}
                  wrap={24}
                  format={(h) => clockFromMinutes(h * 60)}
                  onChange={sky.setPreview}
                />
              </View>
            </>
          )}
        </Card>
      </Section>

      <Section title="Connections">
        <Card padding={0}>
          <Row
            icon={<IconCircle name="heart.fill" color={colors.low} />}
            title="Apple Health"
            onPress={() =>
              setInfo({
                title: 'Apple Health',
                subtitle: 'Not connected',
                body: [
                  'Somni reads Sleep Analysis only: when you fell asleep, woke up, and your sleep stages. Never heart rate or other health data.',
                  'For now, use Log sleep, or the "SleepSquad Sync" Shortcut, to bring nights in.',
                ],
                action: {
                  label: 'Log a night instead',
                  onPress: () => {
                    setInfo(null);
                    setTimeout(() => setSheet('log'), 450);
                  },
                },
              })
            }
            right={
              <View style={styles.status}>
                <View style={[styles.dot, { backgroundColor: colors.dimBar }]} />
                <Text style={t.caption}>Not connected</Text>
              </View>
            }
          />
        </Card>
      </Section>

      <Pressable style={({ pressed }) => [styles.delete, pressed && styles.pressed]} onPress={confirmDelete}>
        <SymbolView name="trash.fill" size={18} tintColor={colors.danger} />
        <Text style={styles.deleteText}>Delete my data</Text>
      </Pressable>

      <Card padding={0}>
        <Row
          icon={<IconCircle name="rectangle.portrait.and.arrow.right" />}
          title="Log out"
          onPress={() => {
            signOut();
            router.replace('/login');
          }}
        />
      </Card>

      <Text style={[t.caption, styles.note]}>Somni is not medical advice.</Text>

      <TargetsSheet visible={sheet === 'targets'} onClose={close} />
      <SquadSheet visible={sheet === 'squad'} onClose={close} backendSquad={user?.squad} />
      <LogSleepSheet visible={sheet === 'log'} onClose={close} />
      <InfoSheet info={info} onClose={() => setInfo(null)} />
    </Screen>
  );
}

function Stat({ icon, value, label, onPress }: { icon?: SFSymbol; value: string; label: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.stat, pressed && styles.pressed]} onPress={onPress}>
      <View style={styles.statValue}>
        {icon && <SymbolView name={icon} size={16} tintColor={colors.textSoft} />}
        <Text style={t.rowTitle}>{value}</Text>
      </View>
      <Text style={t.caption}>{label}</Text>
    </Pressable>
  );
}

type RowProps = { icon: ReactNode; title: string; detail?: string; right?: ReactNode; onPress?: () => void };

function Row({ icon, title, detail, right, onPress }: RowProps) {
  const body = (
    <>
      {icon}
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {detail && <Text style={t.caption}>{detail}</Text>}
      </View>
      {right}
      {onPress && <SymbolView name="chevron.right" size={14} tintColor={colors.textSoft} />}
    </>
  );
  if (!onPress) return <View style={styles.row}>{body}</View>;
  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={onPress}>
      {body}
    </Pressable>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: colors.dimBar, true: colors.toggleOn }}
      ios_backgroundColor={colors.dimBar}
      thumbColor={value ? colors.onAccent : '#FFFFFF'}
    />
  );
}

const styles = StyleSheet.create({
  error: { color: colors.danger, fontSize: 14 },
  header: { alignItems: 'center', gap: spacing.sm },
  name: { fontFamily: fontFamily.bold, fontSize: 24, color: colors.text, marginTop: spacing.xs },
  demoPill: { backgroundColor: colors.raised, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  demoText: { fontFamily: fontFamily.medium, fontSize: 12, color: colors.textSoft },
  stats: { flexDirection: 'row' },
  stat: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: spacing.md },
  statValue: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  vline: { width: 1, backgroundColor: colors.divider },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.md },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: fontFamily.semibold, fontSize: 16, color: colors.text },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepper: { paddingHorizontal: spacing.md, paddingVertical: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  delete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  deleteText: { fontFamily: fontFamily.semibold, fontSize: 16, color: colors.danger },
  pressed: { opacity: 0.8 },
  note: { textAlign: 'center' },
});
