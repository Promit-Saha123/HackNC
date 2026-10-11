import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { api } from '@/api/client';
import type { SquadMember } from '@/api/types';
import { Avatar } from '@/components/Avatar';
import { Card, Divider } from '@/components/Card';
import { GradientButton, OutlineButton } from '@/components/GradientButton';
import { Segmented } from '@/components/Segmented';
import { Sheet } from '@/components/Sheet';
import { usePrefs } from '@/state/prefs';
import { useUser } from '@/state/user';
import { colors } from '@/theme/colors';
import { fontFamily, type as t } from '@/theme/fonts';
import { radius } from '@/theme/spacing';

type Props = { visible: boolean; onClose: () => void };

/** Your squad and its members, or join one with an invite code / create a new one. */
export function SquadSheet({ visible, onClose }: Props) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Squads" subtitle="Squads compete on their members' average score.">
      {visible && <SquadForm />}
    </Sheet>
  );
}

const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

function SquadForm() {
  const { squad, setSquad } = usePrefs();
  const { userId } = useUser();
  const [mode, setMode] = useState<'join' | 'create'>('join');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Members plus the invite code they belong to, so a stale list never shows after switching squads.
  const [loaded, setLoaded] = useState<{ code: string; members: SquadMember[] } | null>(null);
  const members = squad?.code && loaded?.code === squad.code ? loaded.members : null;

  useEffect(() => {
    const code = squad?.code;
    if (!code) return;
    let live = true;
    api
      .squad(code)
      .then((d) => live && setLoaded({ code, members: d.members }))
      .catch(() => live && setLoaded({ code, members: [] }));
    return () => {
      live = false;
    };
  }, [squad?.code]);

  const run = async (action: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      setText('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setError(errorText(e, fallback));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    const value = text.trim();
    if (!value) return;
    if (mode === 'join') run(async () => setSquad(await api.joinSquad(value.toUpperCase())), 'Could not join that squad.');
    else run(async () => setSquad(await api.createSquad(value)), 'Could not create that squad.');
  };

  const leave = () => run(async () => {
    await api.leaveSquad();
    setSquad(null);
  }, 'Could not leave the squad.');

  return (
    <View style={styles.body}>
      <Card>
        <Text style={t.caption}>Your squad</Text>
        <Text style={t.rowTitle}>{squad?.name ?? 'Not in a squad yet'}</Text>
        {squad?.code ? (
          <View style={styles.codeRow}>
            <Text style={[t.body, styles.flex]}>Invite code: {squad.code}</Text>
            <Text
              style={styles.share}
              onPress={() => Share.share({ message: `Join my Somnia squad "${squad.name}" with code ${squad.code}` })}>
              Share
            </Text>
          </View>
        ) : null}
      </Card>

      {squad && (
        <Card padding={0}>
          {members == null && <Text style={[t.caption, styles.pad]}>Loading members...</Text>}
          {members?.length === 0 && <Text style={[t.caption, styles.pad]}>No visible members yet.</Text>}
          {members?.map((m, i) => (
            <View key={m.user_id}>
              {i > 0 && <Divider />}
              <View style={styles.member}>
                <Avatar name={m.name} size={30} glow={false} />
                <Text style={[t.rowTitle, styles.flex]}>{m.user_id === userId ? 'You' : m.name}</Text>
                <SymbolView name="moon.fill" size={11} tintColor={colors.textSoft} />
                <Text style={t.caption}>{m.streak_days ?? 0}</Text>
              </View>
            </View>
          ))}
        </Card>
      )}

      <Segmented
        options={[
          { key: 'join', label: squad ? 'Switch' : 'Join' },
          { key: 'create', label: 'Create' },
        ]}
        value={mode}
        onChange={(m) => {
          setMode(m);
          setError(null);
          setText('');
        }}
      />

      <TextInput
        value={text}
        onChangeText={(v) => {
          setText(v);
          setError(null);
        }}
        placeholder={mode === 'join' ? 'Invite code, like WOLF23' : 'Squad name, like Wolfpack Floor 3'}
        placeholderTextColor={colors.textSoft}
        autoCapitalize={mode === 'join' ? 'characters' : 'words'}
        autoCorrect={false}
        style={styles.input}
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      {error && <Text style={styles.error}>{error}</Text>}

      <GradientButton
        label={busy ? 'One sec...' : mode === 'join' ? 'Join squad' : 'Create squad'}
        onPress={submit}
        disabled={!text.trim() || busy}
      />
      {squad && <OutlineButton label="Leave squad" onPress={leave} />}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 14 },
  flex: { flex: 1 },
  pad: { padding: 14 },
  codeRow: { flexDirection: 'row', alignItems: 'center' },
  share: { fontFamily: fontFamily.semibold, fontSize: 15, color: colors.text, textDecorationLine: 'underline' },
  member: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  input: {
    height: 52,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.switcherBg,
    paddingHorizontal: 16,
    color: colors.text,
    fontFamily: fontFamily.medium,
    fontSize: 16,
  },
  error: { color: colors.danger, fontSize: 14 },
});
