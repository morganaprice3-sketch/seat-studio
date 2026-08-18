import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../src/theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: colors.background },
          animation: 'default',
          gestureEnabled: true
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="builder" options={{ title: 'Build workout', headerBackTitle: 'Back' }} />
        <Stack.Screen name="run" options={{ title: 'Workout', headerBackTitle: 'Build' }} />
        <Stack.Screen name="summary" options={{ title: 'Complete', headerBackVisible: false, gestureEnabled: false }} />
      </Stack>
    </>
  );
}
