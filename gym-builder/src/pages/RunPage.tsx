import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { coreExercises, workoutData } from '../data/workoutData';
import { useWorkoutStore } from '../store/workoutStore';
import { ExerciseSection } from '../types/workout';

type SelectedItem = {
  section: ExerciseSection;
  exercise: {
    name: string;
    muscleGroups: string;
  };
  key: string;
};

export default function RunPage() {
  const navigate = useNavigate();
  const workoutType = useWorkoutStore((state) => state.workoutType);
  const selectedBySection = useWorkoutStore((state) => state.selectedBySection);
  const coreSupersetsByMainExercise = useWorkoutStore((state) => state.coreSupersetsByMainExercise);
  const toggleCoreExercise = useWorkoutStore((state) => state.toggleCoreExercise);

  const [index, setIndex] = useState(0);

  if (!workoutType) {
    return <Navigate to="/" replace />;
  }

  const orderedSelections = useMemo(() => {
    const items: SelectedItem[] = [];

    workoutData[workoutType].forEach((section) => {
        const selected = selectedBySection[section.key];
        if (!selected) {
          return;
        }

        items.push({ section, exercise: selected, key: `${section.key}:${selected.name}` });
      });

    return items;
  }, [selectedBySection, workoutType]);

  if (orderedSelections.length === 0) {
    return <Navigate to="/builder" replace />;
  }

  const current = orderedSelections[index];
  const selectedCore = coreSupersetsByMainExercise[current.key] ?? [];

  return (
    <section className="page page-narrow">
      <div className="card run-card">
        <h2>Run</h2>
        <p className="muted">
          Exercise {index + 1} of {orderedSelections.length}
        </p>

        <div className="exercise-focus">
          <h3>{current.exercise.name}</h3>
          <p className="muted">Section: {current.section.label}</p>
          <p>{current.exercise.muscleGroups}</p>
        </div>

        <div className="core-superset">
          <h4>Add core superset (optional)</h4>
          <div className="checkbox-list">
            {coreExercises.map((core) => (
              <label key={core.name} className="checkbox-item">
                <input
                  type="checkbox"
                  checked={selectedCore.includes(core.name)}
                  onChange={() => toggleCoreExercise(current.key, core.name)}
                />
                <span>
                  {core.name} <small className="muted">({core.muscleGroups})</small>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="button-row">
          <button type="button" className="btn" onClick={() => navigate('/builder')}>
            Edit Builder
          </button>
          <button
            type="button"
            className="btn"
            disabled={index === 0}
            onClick={() => setIndex((prev) => prev - 1)}
          >
            Back
          </button>
          {index < orderedSelections.length - 1 ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIndex((prev) => prev + 1)}
            >
              Next
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => navigate('/summary')}>
              Finish
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
