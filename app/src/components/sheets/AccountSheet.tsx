import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import type { Profile } from '@/api/types';
import { GradientButton } from '@/components/GradientButton';
import { Sheet } from '@/components/Sheet';
import { TextField } from '@/components/TextField';
import { colors } from '@/theme/colors';
import { type as t } from '@/theme/fonts';

export type AccountMode = 'profile' | 'password';

type Props = { mode: AccountMode | null; profile: Profile | null; onClose: () => void; onSaved: (p?: Profile) => void };

/** Edit name and bio (PUT /me) or change password (POST /me/password). Real accounts only. */
export function AccountSheet({ mode, profile, onClose, onSaved }: Props) {
  return (
    <Sheet
      visible={mode != null}
      onClose={onClose}
      title={mode === 'password' ? 'Change password' : 'Edit profile'}
      subtitle={mode === 'password' ? 'You need your current password.' : 'Friends see your name and bio.'}>
      {mode === 'profile' && profile && <ProfileForm profile={profile} onDone={(p) => { onSaved(p); onClose(); }} />}
      {mode === 'password' && <PasswordForm onDone={() => { onSaved(); onClose(); }} />}
    </Sheet>
  );
}

const messageOf = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

function ProfileForm({ profile, onDone }: { profile: Profile; onDone: (p: Profile) => void }) {
  const [name, setName] = useState(profile.name);
  const [bio, setBio] = useState(profile.bio ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const p = await api.updateMe({ name: name.trim() !== profile.name ? name.trim() : null, bio: bio.trim() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onDone(p);
    } catch (e) {
      setError(messageOf(e, 'Could not save your profile.'));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.body}>
      <TextField label="Username" value={name} onChangeText={setName} autoCapitalize="none" autoCorrect={false} />
      <TextField label="Bio" value={bio} onChangeText={setBio} placeholder="Early bird in training" maxLength={160} />
      {error && <Text style={styles.error}>{error}</Text>}
      <GradientButton label={busy ? 'Saving...' : 'Save'} onPress={save} disabled={busy || name.trim().length < 3} />
    </View>
  );
}

function PasswordForm({ onDone }: { onDone: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (next.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.changePassword(current, next);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onDone();
    } catch (e) {
      setError(messageOf(e, 'Could not change your password.'));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.body}>
      <TextField label="Current password" value={current} onChangeText={setCurrent} secureTextEntry textContentType="password" />
      <TextField
        label="New password"
        value={next}
        onChangeText={setNext}
        secureTextEntry
        textContentType="newPassword"
        placeholder="At least 8 characters"
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <GradientButton label={busy ? 'Saving...' : 'Change password'} onPress={save} disabled={busy || !current || !next} />
      <Text style={t.caption}>Only a hash of your password is stored, never the password itself.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 14 },
  error: { color: colors.danger, fontSize: 14 },
});
