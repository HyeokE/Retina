import { Platform } from 'react-native';

// The Android emulator reaches the host machine's loopback through 10.0.2.2.
const DEFAULT_API_BASE_URL = Platform.OS === 'android' ? 'http://10.0.2.2:4010' : 'http://127.0.0.1:4010';

// EXPO_PUBLIC_* values are inlined at bundle time, so they must be read with
// plain dot access (no destructuring or dynamic keys).
export const config = Object.freeze({
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL,
});
