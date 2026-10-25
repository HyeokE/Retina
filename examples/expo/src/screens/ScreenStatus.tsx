import { StyleSheet, Text } from 'react-native';
import { Button, Screen, colors } from '../components/ui';

interface ScreenStatusProps {
  readonly message: string;
  readonly onRetry?: () => void;
}

// Loading and error states never render the Retina ready marker, so a capture
// cannot fire before the screen has its data.
export function ScreenStatus({ message, onRetry }: ScreenStatusProps) {
  return (
    <Screen>
      <Text testID="screen-status" style={styles.message} accessibilityRole={onRetry ? 'alert' : 'text'}>
        {message}
      </Text>
      {onRetry ? <Button label="Try again" onPress={onRetry} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  message: {
    fontSize: 16,
    color: colors.text,
  },
});
