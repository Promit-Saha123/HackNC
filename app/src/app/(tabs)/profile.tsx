import { router } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Pressable, Share, StyleSheet, Switch, Text, View } from 'react-native';

import { api } from '@/api/client';
import type { Profile, SyncStatus } from '@/api/types';
import { Avatar } from '@/components/Avatar';
import { Card, Divider } from '@/components/Card';
import { IconCircle } from '@/components/IconCircle';
import { AccountSheet, type AccountMode } from '@/components/sheets/AccountSheet';
import { Screen, Section } from '@/components/Screen';
import { InfoSheet, type Info } from '@/components/sheets/InfoSheet';
import { LogSleepSheet } from '@/components/sheets/LogSleepSheet';
import { SquadSheet } from '@/components/sheets/SquadSheet';
import { TargetsSheet } from '@/components/sheets/TargetsSheet';
import { useOverview } from '@/hooks/use-overview';
import { usePrefs } from '@/state/prefs';
import { useUser } from '@/state/user';
import { colors } from '@/theme/colors';
import { fontFamily, type as t } from '@/theme/fonts';
import { spacing } from '@/theme/spacing';
import { badgeStates } from '@/utils/badges';
import { clockFromMinutes, toDate } from '@/utils/format';

type SheetKey = 'targets' | 'squad' | 'log';

export default function ProfileScreen() {
  const { overview, error, refreshing, refresh } = useOverview();
  const { goals, squad, privacy, setPrivacy } = usePrefs();
  const { signOut, version } = useUser();
  const [sheet, setSheet] = useState<SheetKey | null>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const [account, setAccount] = useState<AccountMode | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sync, setSync] = useState<SyncStatus | null>(null);

  useEffect(() => {
    let live = true;
    api.profile().then((p) => live && setProfile(p)).catch(() => {});
    api.syncStatus().then((s) => live && setSync(s)).catch(() => {});
    return () => {
      live = false;
    };
  }, [version, refreshing]);

  const user = overview?.user;
  const isDemo = profile?.is_demo ?? user?.is_demo ?? true;
  const squadName = squad?.name ?? null;
  const history = overview?.history ?? [];
  const avgScore = profile?.stats?.avg_score ?? null;
  const avg =
    avgScore != null
      ? Math.round(avgScore)
      : history.length
        ? Math.round(history.reduce((s, h) => s + h.score, 0) / history.length)
        : null;
  const avgNights = avgScore != null ? Math.min(30, profile?.stats?.nights ?? 30) : history.length;

  const togglePrivacy = (patch: Parameters<typeof setPrivacy>[0]) =>
    setPrivacy(patch).catch((e: Error) => Alert.alert("Couldn't save", e.message));

  const shareShortcutKey = async () => {
    try {
      const { token } = await api.ingestToken();
      await Share.share({ message: token });
    } catch (e) {
      Alert.alert("Couldn't get your key", e instanceof Error ? e.message : 'Try again.');
    }
  };
  const streak = overview?.streak_days ?? 0;
  const badgeCount = badgeStates(streak, overview?.badge).filter((b) => b.unlocked).length;
  const close = () => setSheet(null);

  const confirmDelete = () =>
    isDemo
      ? Alert.alert(
          'Demo profile',
          "Demo profiles are shared by everyone trying Somnia, so they can't be deleted. Create your own account to try it.",
        )
      : Alert.alert('Delete my data?', 'This removes all of your sleep nights and scores. It cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteMyData();
            signOut();
            router.replace('/login');
          } catch (e) {
            Alert.alert("Couldn't delete", e instanceof Error ? e.message : 'Try again.');
          }
        },
      },
    ]);

  return (
    <Screen title="Profile" refreshing={refreshing} onRefresh={refresh}>
      {error && <Text style={styles.error}>Can&apos;t reach the backend: {error}</Text>}

      <View style={styles.header}>
        <Avatar name={user?.name ?? '?'} size={96} />
        <Text style={styles.name}>{profile?.name ?? user?.name ?? ' '}</Text>
        {profile?.bio ? <Text style={[t.body, styles.center]}>{profile.bio}</Text> : null}
        {isDemo && (
          <Pressable
            onPress={() =>
              setInfo({
                title: 'Demo profile',
                body: [
                  'This account and the friends on the leaderboard are synthetic demo profiles, so you can try Somnia without real sleep data.',
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
                subtitle: avg == null ? undefined : `${avg}% over your last ${avgNights} nights`,
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
            right={<Toggle value={privacy.share_details} onChange={(v) => togglePrivacy({ share_details: v })} />}
          />
          <Divider />
          <Row
            icon={<IconCircle name="trophy.fill" />}
            title="Show me on leaderboard"
            detail={privacy.show_on_board ? 'Friends always see score and streak only' : 'Hidden from every leaderboard'}
            right={<Toggle value={privacy.show_on_board} onChange={(v) => togglePrivacy({ show_on_board: v })} />}
          />
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
                subtitle: syncLabel(sync),
                body: [
                  'Somnia reads Sleep Analysis only: when you fell asleep, woke up, and your sleep stages. Never heart rate or other health data.',
                  sync?.connected
                    ? `The "SleepSquad Sync" Shortcut has brought in ${sync.nights_synced ?? 0} nights. Run it again to update.`
                    : 'Run the "SleepSquad Sync" Shortcut to bring nights in, or use Log sleep.',
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
                <View style={[styles.dot, { backgroundColor: sync?.connected ? colors.up : colors.dimBar }]} />
                <Text style={t.caption}>{sync?.connected ? 'Connected' : 'Not connected'}</Text>
              </View>
            }
          />
        </Card>
      </Section>

      {!isDemo && (
        <Section title="Account">
          <Card padding={0}>
            <Row icon={<IconCircle name="person.fill" />} title="Edit profile" detail="Username and bio" onPress={() => setAccount('profile')} />
            <Divider />
            <Row icon={<IconCircle name="lock.fill" />} title="Change password" onPress={() => setAccount('password')} />
            <Divider />
            <Row
              icon={<IconCircle name="key.fill" />}
              title="Shortcut key"
              detail="Paste it into the SleepSquad Sync Shortcut"
              onPress={shareShortcutKey}
            />
          </Card>
        </Section>
      )}

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

      <Text style={[t.caption, styles.note]}>Somnia is not medical advice.</Text>

      <TargetsSheet visible={sheet === 'targets'} onClose={close} />
      <SquadSheet visible={sheet === 'squad'} onClose={close} />
      <AccountSheet mode={account} profile={profile} onClose={() => setAccount(null)} onSaved={(p) => p && setProfile(p)} />
      <LogSleepSheet visible={sheet === 'log'} onClose={close} />
      <InfoSheet info={info} onClose={() => setInfo(null)} />
    </Screen>
  );
}

/** "Last synced 2 h ago" style label for the Apple Health row. */
function syncLabel(sync: SyncStatus | null) {
  if (!sync?.connected || !sync.last_sync_at) return 'Not connected';
  const mins = Math.max(0, Math.round((Date.now() - toDate(sync.last_sync_at).getTime()) / 60000));
  if (mins < 60) return `Last synced ${mins} min ago`;
  if (mins < 48 * 60) return `Last synced ${Math.round(mins / 60)} h ago`;
  return `Last synced ${Math.round(mins / 1440)} days ago`;
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
  dot: { width: 8, height: 8, borderRadius: 4 },
  delete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  deleteText: { fontFamily: fontFamily.semibold, fontSize: 16, color: colors.danger },
  pressed: { opacity: 0.8 },
  note: { textAlign: 'center' },
  center: { textAlign: 'center' },
});
