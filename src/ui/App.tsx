import { Routes, Route, Outlet } from 'react-router-dom';
import { AgendaScreen } from '@/ui/screens/AgendaScreen';
import { SearchScreen } from '@/ui/screens/SearchScreen';
import { RecordVisitScreen } from '@/ui/screens/RecordVisitScreen';
import { FieldHistoryScreen } from '@/ui/screens/FieldHistoryScreen';
import { CatalogHubScreen } from '@/ui/screens/CatalogHubScreen';
import { ZonesListScreen } from '@/ui/screens/ZonesListScreen';
import { ZoneFormScreen } from '@/ui/screens/ZoneFormScreen';
import { ClientsListScreen } from '@/ui/screens/ClientsListScreen';
import { ClientFormScreen } from '@/ui/screens/ClientFormScreen';
import { FieldsListScreen } from '@/ui/screens/FieldsListScreen';
import { FieldFormScreen } from '@/ui/screens/FieldFormScreen';
import { VisitDetailScreen } from '@/ui/screens/VisitDetailScreen';
import { ScheduledVisitFormScreen } from '@/ui/screens/ScheduledVisitFormScreen';
import { ScheduledVisitDetailScreen } from '@/ui/screens/ScheduledVisitDetailScreen';
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
        <Route path="/catalogo" element={<CatalogHubScreen />} />
        <Route path="/catalogo/zonas" element={<ZonesListScreen />} />
        <Route path="/catalogo/clientes" element={<ClientsListScreen />} />
        <Route path="/catalogo/lotes" element={<FieldsListScreen />} />
      </Route>
      <Route path="/field/:fieldId/record" element={<RecordVisitScreen />} />
      <Route path="/field/:fieldId/visitas" element={<FieldHistoryScreen />} />
      <Route path="/field/:fieldId/visitas/:visitId" element={<VisitDetailScreen />} />
      <Route path="/field/:fieldId/programar" element={<ScheduledVisitFormScreen />} />
      <Route path="/field/:fieldId/programar/:scheduledVisitId" element={<ScheduledVisitFormScreen />} />
      <Route path="/field/:fieldId/programadas/:scheduledVisitId" element={<ScheduledVisitDetailScreen />} />
      <Route path="/catalogo/zonas/nueva" element={<ZoneFormScreen />} />
      <Route path="/catalogo/zonas/:id" element={<ZoneFormScreen />} />
      <Route path="/catalogo/clientes/nuevo" element={<ClientFormScreen />} />
      <Route path="/catalogo/clientes/:id" element={<ClientFormScreen />} />
      <Route path="/catalogo/lotes/nuevo" element={<FieldFormScreen />} />
      <Route path="/catalogo/lotes/:id" element={<FieldFormScreen />} />
    </Routes>
  );
}
