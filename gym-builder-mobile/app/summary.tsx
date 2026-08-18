import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { workoutData } from '../src/data/workoutData';
import { useWorkoutStore } from '../src/store/workoutStore';
import { colors, radius } from '../src/theme';

export default function SummaryScreen() {
  const workoutType = useWorkoutStore((state) => state.workoutType);
  const selectedBySection = useWorkoutStore((state) => state.selectedBySection);
  const coreSupersets = useWorkoutStore((state) => state.coreSupersetsByMainExercise);
  const resetWorkout = useWorkoutStore((state) => state.resetWorkout);

  const completed = workoutType
    ? workoutData[workoutType].flatMap((section) => {
        const exercise = selectedBySection[section.key];
        if (!exercise) return [];
        const key = `${section.key}:${exercise.name}`;
        return [{ section: section.label, exercise, core: coreSupersets[key] ?? [] }];
      })
    : [];

  const done = () => {
    resetWorkout();
    router.replace('/');
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>WORKOUT COMPLETE</Text>
        <Text style={styles.title}>Done for today.</Text>
        <Text style={styles.subtitle}>A clean finish. Here’s what you built.</Text>

        <View style={styles.summaryCard}>
          {completed.map((item, index) => (
            <View key={`${item.section}:${item.exercise.name}`} style={[styles.row, index > 0 && styles.divider]}>
              <Text style={styles.section}>{item.section}</Text>
              <Text style={styles.exercise}>{item.exercise.name}</Text>
              {item.core.length > 0 ? <Text style={styles.core}>+ {item.core.join(' · ')}</Text> : null}
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable onPress={done} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
          <Text style={styles.primaryText}>Done</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 34, paddingBottom: 120 },
  kicker: { fontSize: 12, fontWeight: '700', letterSpacing: 1.8, color: colors.muted },
  title: { marginTop: 12, fontSize: 40, lineHeight: 44, letterSpacing: -1.2, fontWeight: '700', color: colors.text },
  subtitle: { marginTop: 10, fontSize: 17, lineHeight: 24, color: colors.muted },
  summaryCard: { marginTop: 32, paddingHorizontal: 20, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  row: { paddingVertical: 20 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  section: { fontSize: 12, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase', color: colors.muted },
  exercise: { marginTop: 6, fontSize: 20, lineHeight: 25, fontWeight: '650', color: colors.text },
  core: { marginTop: 7, fontSize: 14, lineHeight: 20, color: colors.muted },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30, backgroundColor: colors.background, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  primary: { height: 58, borderRadius: 18, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: colors.accentText, fontSize: 17, fontWeight: '700' },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.86 }
});
