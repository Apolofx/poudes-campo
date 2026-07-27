import { Routes, Route } from 'react-router-dom';
import { SearchScreen } from '@/ui/screens/SearchScreen';
import { RecordVisitScreen } from '@/ui/screens/RecordVisitScreen';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<SearchScreen />} />
      <Route path="/field/:fieldId/record" element={<RecordVisitScreen />} />
    </Routes>
  );
}
