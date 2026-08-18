import { useMemo, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { Redirect, router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { coreExercises, workoutData } from '../src/data/workoutData';
import { useWorkoutStore } from '../src/store/workoutStore';
import { colors, radius } from '../src/theme';

export default function RunScreen() {
  const workoutType = useWorkoutStore((state) => state.workoutType);
  const selectedBySection = useWorkoutStore((state) => state.selectedBySection);
  const coreSupersets = useWorkoutStore((state) => state.coreSupersetsByMainExercise);
  const toggleCoreExercise = useWorkoutStore((state) => state.toggleCoreExercise);
  const [index, setIndex] = useState(0);

  const selections = useMemo(() => {
    if (!workoutType) return [];
    return workoutData[workoutType].flatMap((section) => {
      const exercise = selectedBySection[section.key];
      return exercise ? [{ section, exercise, key: `${section.key}:${exercise.name}` }] : [];
    });
  }, [selectedBySection, workoutType]);

  if (!workoutType) return <Redirect href="/" />;
  if (selections.length === 0) return <Redirect href="/builder" />;

  const current = selections[Math.min(index, selections.length - 1)];
  const selectedCore = coreSupersets[current.key] ?? [];
  const progress = ((index + 1) / selections.length) * 100;

  const advance = async () => {
    if (index < selections.length - 1) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setIndex((value) => value + 1);
    } else {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/summary');
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.step}>EXERCISE {index + 1} OF {selections.length}</Text>
        <Text style={styles.sectionLabel}>{current.section.label}</Text>

        <View style={styles.focusCard}>
          <Text style={styles.exercise}>{current.exercise.name}</Text>
          <Text style={styles.muscles}>{current.exercise.muscleGroups}</Text>
        </View>

        <View style={styles.coreBlock}>
          <Text style={styles.coreTitle}>Add a core superset</Text>
          <Text style={styles.coreSubtitle}>Optional. Tap any movement to pair it with this exercise.</Text>
          <View style={styles.coreList}>
            {coreExercises.map((core) => {
              const selected = selectedCore.includes(core.name);
              return (
                <Pressable
                  key={core.name}
                  onPress={async () => {
                    await Haptics.selectionAsync();
                    toggleCoreExercise(current.key, core.name);
                  }}
                  style={({ pressed }) => [styles.coreOption, selected && styles.coreSelected, pressed && styles.pressed]}
                >
                  <View style={styles.coreCopy}>
                    <Text style={styles.coreName}>{core.name}</Text>
                    <Text style={styles.coreMuscles}>{core.muscleGroups}</Text>
                  </View>
                  <Text style={styles.check}>{selected ? '✓' : '+'}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.actions}>
          <Pressable
            disabled={index === 0}
            onPress={() => setIndex((value) => Math.max(0, value - 1))}
            style={({ pressed }) => [styles.secondary, index === 0 && styles.hidden, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryText}>Back</Text>
          </Pressable>
          <Pressable onPress={advance} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
            <Text style={styles.primaryText}>{index === selections.length - 1 ? 'Finish workout' : 'Next exercise'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  progressTrack: { height: 3, backgroundColor: colors.border },
  progressFill: { height: 3, backgroundColor: colors.accent },
  content: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 130 },
  step: { fontSize: 12, letterSpacing: 1.6, fontWeight: '700', color: colors.muted },
  sectionLabel: { marginTop: 10, fontSize: 18, fontWeight: '600', color: colors.muted },
  focusCard: { marginTop: 18, padding: 24, minHeight: 190, borderRadius: radius.lg, backgroundColor: colors.accent, justifyContent: 'flex-end' },
  exercise: { fontSize: 36, lineHeight: 40, letterSpacing: -1.1, fontWeight: '700', color: colors.accentText },
  muscles: { marginTop: 12, fontSize: 15, lineHeight: 21, color: '#D8DCCF' },
  coreBlock: { marginTop: 32 },
  coreTitle: { fontSize: 22, fontWeight: '700', color: colors.text },
  coreSubtitle: { marginTop: 6, fontSize: 15, lineHeight: 21, color: colors.muted },
  coreList: { marginTop: 16, gap: 10 },
  coreOption: { minHeight: 70, paddingHorizontal: 16, paddingVertical: 13, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center' },
  coreSelected: { backgroundColor: colors.selected, borderColor: colors.selectedBorder },
  coreCopy: { flex: 1, paddingRight: 12 },
  coreName: { fontSize: 16, fontWeight: '600', color: colors.text },
  coreMuscles: { marginTop: 3, fontSize: 13, color: colors.muted },
  check: { width: 28, textAlign: 'center', fontSize: 22, fontWeight: '500', color: colors.text },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30, backgroundColor: colors.background, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  actions: { flexDirection: 'row', gap: 10 },
  secondary: { width: 84, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  secondaryText: { fontSize: 16, fontWeight: '600', color: colors.text },
  primary: { flex: 1, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: colors.accent },
  primaryText: { fontSize: 17, fontWeight: '700', color: colors.accentText },
  hidden: { opacity: 0 },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.86 }
});
