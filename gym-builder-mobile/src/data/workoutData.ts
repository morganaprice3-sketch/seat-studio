import { Exercise, WorkoutConfig } from '../types/workout';

const m = (name: string, muscleGroups: string): Exercise => ({ name, muscleGroups });

export const workoutData: WorkoutConfig = {
  upper: [
    {
      key: 'push',
      label: 'Push',
      exercises: [
        m('Dumbbell Bench Press', 'Chest, triceps, front delts'),
        m('Incline Dumbbell Press', 'Upper chest, triceps, shoulders'),
        m('Push-Ups', 'Chest, shoulders, triceps')
      ]
    },
    {
      key: 'pull',
      label: 'Pull',
      exercises: [
        m('Seated Cable Row', 'Lats, mid-back, biceps'),
        m('Lat Pulldown', 'Lats, biceps, rear delts'),
        m('Single-Arm Dumbbell Row', 'Lats, rhomboids, biceps')
      ]
    }
  ],
  lower: [
    {
      key: 'hinge',
      label: 'Hinge',
      exercises: [
        m('Dumbbell RDL', 'Hamstrings, glutes, erectors'),
        m('B-Stance RDL', 'Hamstrings, glutes, balance/stability'),
        m('Cable Pull-Through', 'Glutes, hamstrings, core'),
        m('Landmine Deadlift', 'Glutes, hamstrings, quads'),
        m('Kettlebell Swings', 'Glutes, hamstrings, posterior chain')
      ]
    },
    {
      key: 'thrust',
      label: 'Thrust',
      exercises: [
        m('Barbell Hip Thrust', 'Glutes, hamstrings'),
        m('Dumbbell Hip Thrust', 'Glutes, hamstrings'),
        m('Glute Bridge', 'Glutes, hamstrings, core'),
        m('Frog Pumps', 'Glutes'),
        m('Kas Glute Bridge', 'Glutes, hamstrings')
      ]
    },
    {
      key: 'squat',
      label: 'Squat',
      exercises: [
        m('Landmine Sumo Squat', 'Glutes, adductors, quads'),
        m('Heels-Elevated Goblet Squat', 'Quads, glutes, core'),
        m('Front Squat', 'Quads, glutes, core'),
        m('Smith Machine Glute-Biased Squat', 'Glutes, quads, hamstrings'),
        m('Bodyweight Tempo Squat', 'Quads, glutes, muscular endurance')
      ]
    },
    {
      key: 'unilateral',
      label: 'Unilateral',
      exercises: [
        m('Dumbbell Step-Ups', 'Glutes, quads, calves'),
        m('Walking Lunges', 'Glutes, quads, hamstrings'),
        m('Bulgarian Split Squat (glute-biased)', 'Glutes, quads, hamstrings'),
        m('Reverse Lunges', 'Glutes, quads, hamstrings'),
        m('Single-Leg Glute Bridge', 'Glutes, hamstrings, core')
      ]
    }
  ],
  cardio: [
    {
      key: 'conditioning',
      label: 'Conditioning',
      exercises: [
        m('Bike Intervals', 'Cardiovascular system, quads, calves'),
        m('Treadmill Incline Walk', 'Cardiovascular system, glutes, calves'),
        m('Row Erg Intervals', 'Cardiovascular system, back, legs')
      ]
    }
  ]
};

export const coreExercises: Exercise[] = [
  m('Dead Bug', 'Deep core, hip flexors'),
  m('Pallof Press', 'Obliques, anti-rotation core'),
  m('Side Plank', 'Obliques, transverse abdominis'),
  m('Hollow Hold', 'Rectus abdominis, deep core')
];
