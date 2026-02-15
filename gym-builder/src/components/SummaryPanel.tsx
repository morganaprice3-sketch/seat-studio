import { coreExercises, workoutData } from '../data/workoutData';
import { useWorkoutStore } from '../store/workoutStore';

export default function SummaryPanel() {
  const workoutType = useWorkoutStore((state) => state.workoutType);
  const selectedBySection = useWorkoutStore((state) => state.selectedBySection);
  const coreSupersetsByMainExercise = useWorkoutStore((state) => state.coreSupersetsByMainExercise);

  if (!workoutType) {
    return null;
  }

  const sections = workoutData[workoutType];

  return (
    <aside className="card summary-panel">
      <h3>Summary</h3>
      <p className="muted">Workout type: {workoutType.toUpperCase()}</p>
      <ul className="summary-list">
        {sections.map((section) => {
          const selected = selectedBySection[section.key];
          const mainExerciseKey = selected ? `${section.key}:${selected.name}` : '';
          const coreForExercise =
            mainExerciseKey.length > 0 ? coreSupersetsByMainExercise[mainExerciseKey] ?? [] : [];

          return (
            <li key={section.key}>
              <strong>{section.label}:</strong> {selected ? selected.name : 'Not selected'}
              {coreForExercise.length > 0 ? (
                <span className="muted"> | Core: {coreForExercise.join(', ')}</span>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="tiny muted">Core options: {coreExercises.map((item) => item.name).join(', ')}</p>
    </aside>
  );
}
