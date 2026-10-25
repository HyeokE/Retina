import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Every screen scrolls, so content (including Save) stays reachable with the
// keyboard open or with a large font scale. iOS needs "padding" to lift the
// content above the keyboard; on Android the window resizes by itself, as in
// Expo's keyboard-handling guide. "handled" lets a tap on Save register while
// the keyboard is still open.
export function Screen({ children }: { readonly children: ReactNode }) {
  return (
    <SafeAreaView style={styles.fill}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          testID="screen-scroll"
          style={styles.fill}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface ButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: 'primary' | 'secondary';
  readonly disabled?: boolean;
  readonly testID?: string;
}

export function Button({ label, onPress, variant = 'secondary', disabled = false, testID }: ButtonProps) {
  const primary = variant === 'primary';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, primary && styles.buttonPrimary, disabled && styles.buttonDisabled]}
    >
      <Text style={[styles.buttonLabel, primary && styles.buttonLabelPrimary]}>{label}</Text>
    </Pressable>
  );
}

export const colors = Object.freeze({
  text: '#1f2328',
  muted: '#59636e',
  border: '#b7bfc8',
  error: '#c62828',
  primary: '#1f5fbf',
  background: '#f6f7f9',
  surface: '#ffffff',
});

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  card: {
    margin: 16,
    padding: 24,
    gap: 16,
    backgroundColor: colors.surface,
    borderColor: '#d8dde3',
    borderWidth: 1,
    borderRadius: 12,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  buttonPrimary: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonLabel: {
    fontSize: 16,
    color: colors.text,
  },
  buttonLabelPrimary: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
