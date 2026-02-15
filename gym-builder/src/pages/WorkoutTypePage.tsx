import { useNavigate } from 'react-router-dom';
import { useWorkoutStore } from '../store/workoutStore';
import { WorkoutType } from '../types/workout';

const options: { label: string; type: WorkoutType }[] = [
  { label: 'Upper Body', type: 'upper' },
  { label: 'Lower Body', type: 'lower' },
  { label: 'Cardio', type: 'cardio' }
];

export default function WorkoutTypePage() {
  const navigate = useNavigate();
  const setWorkoutType = useWorkoutStore((state) => state.setWorkoutType);

  const onSelect = (type: WorkoutType) => {
    setWorkoutType(type);
    navigate('/builder');
  };

  return (
    <section className="page page-center">
      <div className="card">
        <h2>What kind of day is it?</h2>
        <div className="button-row">
          {options.map((option) => (
            <button key={option.type} type="button" className="btn" onClick={() => onSelect(option.type)}>
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
