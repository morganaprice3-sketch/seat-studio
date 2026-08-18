export type WorkoutType = 'upper' | 'lower' | 'cardio';

export type Exercise = {
  name: string;
  muscleGroups: string;
};

export type ExerciseSection = {
  key: string;
  label: string;
  exercises: Exercise[];
};

export type WorkoutConfig = Record<WorkoutType, ExerciseSection[]>;
