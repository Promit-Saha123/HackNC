import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { api } from '@/api/client';
import type { User } from '@/api/types';
import { useUser } from '@/state/user';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';

/** Demo login: tap a profile to view the app as that user. */
export function UserPicker() {
  const { userId, setUserId } = useUser();
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    api.users().then(setUsers).catch(() => setUsers([]));
  }, []);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {users.map((u) => (
        <Pressable
          key={u.id}
          onPress={() => setUserId(u.id)}
          style={[styles.chip, u.id === userId && styles.chipActive]}>
          <Text style={[styles.label, u.id === userId && styles.labelActive]}>{u.name}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  chipActive: { backgroundColor: colors.green },
  label: { color: colors.text, fontWeight: '600' },
  labelActive: { color: '#fff' },
});