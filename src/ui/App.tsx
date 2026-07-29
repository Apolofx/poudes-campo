import { Routes, Route, Outlet } from 'react-router-dom';
import { AgendaScreen } from '@/ui/screens/AgendaScreen';
import { SearchScreen } from '@/ui/screens/SearchScreen';
import { RecordVisitScreen } from '@/ui/screens/RecordVisitScreen';
import { TabBar } from '@/ui/components/TabBar';

function TabsLayout() {
  return (
    <div className="app-shell">
      <div className="app-content">
        <Outlet />
      </div>
      <TabBar />
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<TabsLayout />}>
        <Route path="/" element={<AgendaScreen />} />
        <Route path="/buscar" element={<SearchScreen />} />
      </Route>
      <Route path="/field/:fieldId/record" element={<RecordVisitScreen />} />
    </Routes>
  );
}
