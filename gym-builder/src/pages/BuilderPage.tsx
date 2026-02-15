import { Navigate, useNavigate } from 'react-router-dom';
import { workoutData } from '../data/workoutData';
import { useWorkoutStore } from '../store/workoutStore';

export default function BuilderPage() {
  const navigate = useNavigate();
  const workoutType = useWorkoutStore((state) => state.workoutType);
  const selectedBySection = useWorkoutStore((state) => state.selectedBySection);
  const selectExerciseForSection = useWorkoutStore((state) => state.selectExerciseForSection);

  if (!workoutType) {
    return <Navigate to="/" replace />;
  }

  const sections = workoutData[workoutType];
  const canContinue = sections.every((section) => Boolean(selectedBySection[section.key]));

  return (
    <section className="page">
      <h2>Builder</h2>
      <p className="muted">Choose one movement for each section.</p>
      <div className="sections-grid">
        {sections.map((section) => (
          <article key={section.key} className="card">
            <h3>{section.label}</h3>
            <div className="exercise-list">
              {section.exercises.map((exercise) => {
                const isSelected = selectedBySection[section.key]?.name === exercise.name;
                return (
                  <button
                    type="button"
                    key={exercise.name}
                    className={`exercise-button ${isSelected ? 'selected' : ''}`}
                    onClick={() => selectExerciseForSection(section.key, exercise)}
                  >
                    <span>{exercise.name}</span>
                    <small>{exercise.muscleGroups}</small>
                  </button>
                );
              })}
            </div>
          </article>
        ))}
      </div>
      <div className="button-row">
        <button type="button" className="btn" onClick={() => navigate('/')}>
          Back
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!canContinue}
          onClick={() => navigate('/run')}
        >
          Continue
        </button>
      </div>
    </section>
  );
}
