import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../src/theme';
import { WorkoutType } from '../src/types/workout';
import { useWorkoutStore } from '../src/store/workoutStore';

const options: { type: WorkoutType; eyebrow: string; title: string; detail: string }[] = [
  { type: 'lower', eyebrow: 'Strength', title: 'Lower body', detail: 'Hinge · thrust · squat · unilateral' },
  { type: 'upper', eyebrow: 'Strength', title: 'Upper body', detail: 'Push · pull' },
  { type: 'cardio', eyebrow: 'Conditioning', title: 'Cardio', detail: 'Intervals or steady effort' }
];

export default function HomeScreen() {
  const setWorkoutType = useWorkoutStore((state) => state.setWorkoutType);

  const choose = async (type: WorkoutType) => {
    await Haptics.selectionAsync();
    setWorkoutType(type);
    router.push('/builder');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>GYM BUILDER</Text>
          <Text style={styles.title}>What are we training today?</Text>
          <Text style={styles.subtitle}>Build the session you want, then move through it one exercise at a time.</Text>
        </View>

        <View style={styles.list}>
          {options.map((option) => (
            <Pressable
              key={option.type}
              onPress={() => choose(option.type)}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text style={styles.eyebrow}>{option.eyebrow}</Text>
              <Text style={styles.cardTitle}>{option.title}</Text>
              <Text style={styles.cardDetail}>{option.detail}</Text>
              <Text style={styles.arrow}>→</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, paddingHorizontal: 22, paddingTop: 28, paddingBottom: 24 },
  hero: { marginBottom: 34 },
  kicker: { fontSize: 12, letterSpacing: 2.2, fontWeight: '700', color: colors.muted, marginBottom: 12 },
  title: { fontSize: 42, lineHeight: 46, letterSpacing: -1.5, fontWeight: '700', color: colors.text, maxWidth: 330 },
  subtitle: { marginTop: 16, fontSize: 17, lineHeight: 24, color: colors.muted, maxWidth: 345 },
  list: { gap: 14 },
  card: { minHeight: 132, padding: 20, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, justifyContent: 'center' },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.86 },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, color: colors.muted, textTransform: 'uppercase', marginBottom: 8 },
  cardTitle: { fontSize: 27, fontWeight: '600', letterSpacing: -0.7, color: colors.text },
  cardDetail: { marginTop: 6, fontSize: 15, lineHeight: 20, color: colors.muted, paddingRight: 40 },
  arrow: { position: 'absolute', right: 20, bottom: 20, fontSize: 27, color: colors.text }
});
