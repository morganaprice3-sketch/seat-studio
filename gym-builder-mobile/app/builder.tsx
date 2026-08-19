import * as Haptics from 'expo-haptics';
import { Redirect, router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { workoutData } from '../src/data/workoutData';
import { useWorkoutStore } from '../src/store/workoutStore';
import { colors, radius } from '../src/theme';

export default function BuilderScreen() {
  const workoutType = useWorkoutStore((state) => state.workoutType);
  const selectedBySection = useWorkoutStore((state) => state.selectedBySection);
  const selectExerciseForSection = useWorkoutStore((state) => state.selectExerciseForSection);

  if (!workoutType) return <Redirect href="/" />;

  const sections = workoutData[workoutType];
  const canContinue = sections.every((section) => Boolean(selectedBySection[section.key]));

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Make it yours.</Text>
        <Text style={styles.subtitle}>Choose one movement from each section.</Text>

        {sections.map((section, sectionIndex) => (
          <View key={section.key} style={styles.section}>
            <View style={styles.sectionHeading}>
              <Text style={styles.number}>{String(sectionIndex + 1).padStart(2, '0')}</Text>
              <Text style={styles.sectionTitle}>{section.label}</Text>
            </View>

            <View style={styles.options}>
              {section.exercises.map((exercise) => {
                const selected = selectedBySection[section.key]?.name === exercise.name;
                return (
                  <Pressable
                    key={exercise.name}
                    onPress={async () => {
                      await Haptics.selectionAsync();
                      selectExerciseForSection(section.key, exercise);
                    }}
                    style={({ pressed }) => [
                      styles.option,
                      selected && styles.optionSelected,
                      pressed && styles.pressed
                    ]}
                  >
                    <View style={styles.optionText}>
                      <Text style={styles.exerciseName}>{exercise.name}</Text>
                      <Text style={styles.muscles}>{exercise.muscleGroups}</Text>
                    </View>
                    <View style={[styles.radio, selected && styles.radioSelected]}>
                      {selected ? <View style={styles.radioDot} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          disabled={!canContinue}
          onPress={async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push('/run');
          }}
          style={({ pressed }) => [styles.primary, !canContinue && styles.disabled, pressed && canContinue && styles.pressed]}
        >
          <Text style={styles.primaryText}>{canContinue ? 'Start workout' : 'Choose each movement'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 120 },
  title: { fontSize: 36, lineHeight: 40, fontWeight: '700', letterSpacing: -1.1, color: colors.text },
  subtitle: { marginTop: 8, marginBottom: 30, fontSize: 17, color: colors.muted },
  section: { marginBottom: 30 },
  sectionHeading: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 12 },
  number: { fontSize: 12, fontWeight: '700', color: colors.muted, letterSpacing: 1.2 },
  sectionTitle: { fontSize: 22, fontWeight: '700', color: colors.text },
  options: { gap: 10 },
  option: { minHeight: 78, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, paddingVertical: 15, paddingLeft: 17, paddingRight: 16, flexDirection: 'row', alignItems: 'center' },
  optionSelected: { backgroundColor: colors.selected, borderColor: colors.selectedBorder },
  optionText: { flex: 1, paddingRight: 12 },
  exerciseName: { fontSize: 17, lineHeight: 21, fontWeight: '600', color: colors.text },
  muscles: { marginTop: 4, fontSize: 13, lineHeight: 18, color: colors.muted },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: colors.accent },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accent },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30, backgroundColor: colors.background, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  primary: { height: 58, borderRadius: 18, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: colors.accentText, fontSize: 17, fontWeight: '700' },
  disabled: { opacity: 0.35 },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.88 }
});
