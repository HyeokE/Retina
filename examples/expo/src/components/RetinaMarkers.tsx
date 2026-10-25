import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';

// Contract markers for Retina's native adapter, present only in test builds
// (EXPO_PUBLIC_RETINA_TEST_MODE=1). They are 1x1, transparent and
// non-interactive: invisible in screenshots but still in the native
// view/accessibility tree, where Appium can find them by testID.
//
// The flag is written inline on purpose. Expo inlines EXPO_PUBLIC_* values per
// file at bundle time, and Metro does not fold constants across modules, so
// only an inline comparison lets the minifier drop the test-only branch (and
// its testID strings) from production bundles.

type ReadyMarker = (props: { readonly screen: 'profile' | 'edit' }) => ReactElement | null;

/** Rendered by a screen only after its data has loaded. */
export const RetinaReadyMarker: ReadyMarker =
  process.env.EXPO_PUBLIC_RETINA_TEST_MODE === '1'
    ? ({ screen }) => <View testID={`retina-ready-${screen}`} collapsable={false} style={styles.marker} />
    : () => null;

/**
 * Build identity read from EXPO_PUBLIC_BUILD_ID at bundle time (default "dev").
 * Real projects may source this from expo-updates (updateId, runtimeVersion)
 * or from a custom provider instead of an env var.
 */
export const RetinaBuildId: () => ReactElement | null =
  process.env.EXPO_PUBLIC_RETINA_TEST_MODE === '1'
    ? () => (
        <Text testID="retina-build-id" style={[styles.marker, styles.text]}>
          {process.env.EXPO_PUBLIC_BUILD_ID || 'dev'}
        </Text>
      )
    : () => null;

const styles = StyleSheet.create({
  marker: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 1,
    height: 1,
    backgroundColor: 'transparent',
    pointerEvents: 'none',
  },
  text: {
    color: 'transparent',
    fontSize: 1,
    lineHeight: 1,
  },
});
