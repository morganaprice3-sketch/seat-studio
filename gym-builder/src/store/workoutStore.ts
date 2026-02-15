import { create } from 'zustand';
import { Exercise, WorkoutType } from '../types/workout';

type SelectedBySection = Record<string, Exercise | null>;
type CoreSupersetsByMainExercise = Record<string, string[]>;

type WorkoutState = {
  workoutType: WorkoutType | null;
  selectedBySection: SelectedBySection;
  coreSupersetsByMainExercise: CoreSupersetsByMainExercise;
  setWorkoutType: (type: WorkoutType) => void;
  selectExerciseForSection: (sectionKey: string, exercise: Exercise) => void;
  toggleCoreExercise: (mainExerciseKey: string, coreExerciseName: string) => void;
  resetSelections: () => void;
};

export const useWorkoutStore = create<WorkoutState>((set) => ({
  workoutType: null,
  selectedBySection: {},
  coreSupersetsByMainExercise: {},
  setWorkoutType: (type) =>
    set({
      workoutType: type,
      selectedBySection: {},
      coreSupersetsByMainExercise: {}
    }),
  selectExerciseForSection: (sectionKey, exercise) =>
    set((state) => ({
      selectedBySection: {
        ...state.selectedBySection,
        [sectionKey]: exercise
      }
    })),
  toggleCoreExercise: (mainExerciseKey, coreExerciseName) =>
    set((state) => {
      const current = state.coreSupersetsByMainExercise[mainExerciseKey] ?? [];
      const exists = current.includes(coreExerciseName);

      return {
        coreSupersetsByMainExercise: {
          ...state.coreSupersetsByMainExercise,
          [mainExerciseKey]: exists
            ? current.filter((name) => name !== coreExerciseName)
            : [...current, coreExerciseName]
        }
      };
    }),
  resetSelections: () =>
    set({
      selectedBySection: {},
      coreSupersetsByMainExercise: {}
    })
}));
