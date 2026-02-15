import { Navigate, useNavigate } from 'react-router-dom';
import SummaryPanel from '../components/SummaryPanel';
import { useWorkoutStore } from '../store/workoutStore';

export default function SummaryPage() {
  const navigate = useNavigate();
  const workoutType = useWorkoutStore((state) => state.workoutType);
  const selectedBySection = useWorkoutStore((state) => state.selectedBySection);
  const resetSelections = useWorkoutStore((state) => state.resetSelections);

  if (!workoutType) {
    return <Navigate to="/" replace />;
  }

  const hasAnySelection = Object.values(selectedBySection).some(Boolean);

  if (!hasAnySelection) {
    return <Navigate to="/builder" replace />;
  }

  return (
    <section className="page page-narrow">
      <h2>Workout Summary</h2>
      <SummaryPanel />
      <div className="button-row">
        <button type="button" className="btn" onClick={() => navigate('/run')}>
          Back to Run
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            resetSelections();
            navigate('/');
          }}
        >
          Start New Workout
        </button>
      </div>
    </section>
  );
}
