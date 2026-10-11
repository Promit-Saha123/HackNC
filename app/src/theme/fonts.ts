import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import type { TextStyle } from 'react-native';

import { colors } from './colors';

/** Passed to useFonts() in the root layout. */
export const fontAssets = {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
};

export const fontFamily = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
} as const;

/** Soft shadow so white headings stay readable on the bright daytime sky. */
const lift = { textShadowColor: 'rgba(10,40,90,0.35)', textShadowRadius: 10, textShadowOffset: { width: 0, height: 1 } };

/** Type scale from the design doc. Spread into a Text style: `style={type.title}`. */
export const type = {
  title: { fontFamily: fontFamily.bold, fontSize: 34, color: colors.text, ...lift },
  subtitle: { fontFamily: fontFamily.medium, fontSize: 16, color: colors.textSoft, ...lift },
  bigScore: { fontFamily: fontFamily.bold, fontSize: 48, color: colors.text, fontVariant: ['tabular-nums'] },
  ringLabel: { fontFamily: fontFamily.medium, fontSize: 16, color: colors.textSoft },
  section: { fontFamily: fontFamily.semibold, fontSize: 20, color: colors.text, ...lift },
  rowTitle: { fontFamily: fontFamily.semibold, fontSize: 18, color: colors.text, fontVariant: ['tabular-nums'] },
  body: { fontFamily: fontFamily.regular, fontSize: 15, color: colors.textSoft },
  caption: { fontFamily: fontFamily.regular, fontSize: 13, color: colors.textSoft },
  tabLabel: { fontFamily: fontFamily.medium, fontSize: 11 },
  button: { fontFamily: fontFamily.semibold, fontSize: 17, color: colors.text },
} satisfies Record<string, TextStyle>;
