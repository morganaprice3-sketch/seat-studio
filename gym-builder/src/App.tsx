import { Navigate, Route, Routes } from 'react-router-dom';
import BuilderPage from './pages/BuilderPage';
import RunPage from './pages/RunPage';
import SummaryPage from './pages/SummaryPage';
import WorkoutTypePage from './pages/WorkoutTypePage';

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Gym Builder</h1>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<WorkoutTypePage />} />
          <Route path="/builder" element={<BuilderPage />} />
          <Route path="/run" element={<RunPage />} />
          <Route path="/summary" element={<SummaryPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
