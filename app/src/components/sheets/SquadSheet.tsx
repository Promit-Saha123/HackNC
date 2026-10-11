import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Card } from '@/components/Card';
import { GradientButton, OutlineButton } from '@/components/GradientButton';
import { Segmented } from '@/components/Segmented';
import { Sheet } from '@/components/Sheet';
import { DEMO_SQUAD_CODES } from '@/data/sample';
import { usePrefs } from '@/state/prefs';
import { colors } from '@/theme/colors';
import { fontFamily, type as t } from '@/theme/fonts';
import { radius } from '@/theme/spacing';

type Props = { visible: boolean; onClose: () => void; backendSquad?: string | null };

/** Join a squad with an invite code or create a new one. */
export function SquadSheet({ visible, onClose, backendSquad }: Props) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Squads" subtitle="Squads compete on their members' average score.">
      {visible && <SquadForm backendSquad={backendSquad ?? null} />}
    </Sheet>
  );
}

const codeFor = (name: string) => {
  const letters = name.replace(/[^a-z]/gi, '').toUpperCase().padEnd(4, 'X').slice(0, 4);
  return `${letters}${Math.floor(10 + Math.random() * 90)}`;
};

function SquadForm({ backendSquad }: { backendSquad: string | null }) {
  const { squad, setSquad } = usePrefs();
  const [mode, setMode] = useState<'join' | 'create'>('join');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const current = squad?.name ?? backendSquad;
  const currentCode =
    squad?.code ?? Object.entries(DEMO_SQUAD_CODES).find(([, name]) => name === backendSquad)?.[0] ?? null;

  const submit = () => {
    const value = text.trim();
    if (mode === 'join') {
      const name = DEMO_SQUAD_CODES[value.toUpperCase()];
      if (!name) {
        setError('No squad with that code. Try WOLF23 or OWLS42.');
        return;
      }
      setSquad({ name, code: value.toUpperCase() });
    } else {
      if (value.length < 2) {
        setError('Give your squad a name.');
        return;
      }
      setSquad({ name: value, code: codeFor(value) });
    }
    setText('');
    setError(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <View style={styles.body}>
      <Card>
        <Text style={t.caption}>Your squad</Text>
        <Text style={t.rowTitle}>{current ?? 'Not in a squad yet'}</Text>
        {currentCode && <Text style={t.body}>Invite code: {currentCode}</Text>}
      </Card>

      <Segmented
        options={[
          { key: 'join', label: 'Join' },
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

      <GradientButton label={mode === 'join' ? 'Join squad' : 'Create squad'} onPress={submit} disabled={!text.trim()} />
      {squad && <OutlineButton label="Leave squad" onPress={() => setSquad(null)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 14 },
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
