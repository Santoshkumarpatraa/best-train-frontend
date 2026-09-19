import BestTrain from './pages/BestTrain';
import { useTheme } from './lib/useTheme';
import './styles/app.css';

export default function App() {
  const [theme, toggleTheme] = useTheme();
  return <BestTrain theme={theme} onToggleTheme={toggleTheme} />;
}
