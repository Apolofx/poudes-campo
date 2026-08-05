import { Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
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
import { ConfigScreen } from '@/ui/screens/ConfigScreen';
import { OnboardingWizardScreen } from '@/ui/screens/OnboardingWizardScreen';
import { TabBar } from '@/ui/components/TabBar';
import { InstallBanner } from '@/ui/components/InstallBanner';
import { PwaInstallTracker } from '@/ui/components/PwaInstallTracker';
import { useTenantConfig } from '@/ui/TenantConfigProvider';
import { useFlag } from '@/ui/FlagsProvider';
import { useHasAnyField } from '@/ui/hooks/use-has-any-field';

function TabsLayout() {
  return (
    <div className="app-shell">
      <div className="app-content">
        <InstallBanner />
        <Outlet />
      </div>
      <TabBar />
    </div>
  );
}

function ConfigGate() {
  const { config, loading } = useTenantConfig();
  const onboardingNuevo = useFlag('onboardingNuevo');
  const { hasAnyField, loading: fieldsLoading } = useHasAnyField();
  if (loading || (onboardingNuevo && fieldsLoading)) return null;
  if (onboardingNuevo && (!config || !hasAnyField)) return <Navigate to="/onboarding" replace />;
  if (!config) return <Navigate to="/configuracion" replace />;
  return <Outlet />;
}

export function App() {
  return (
    <>
      <Analytics />
      <PwaInstallTracker />
      <Routes>
      <Route path="/configuracion" element={<ConfigScreen />} />
      <Route path="/onboarding" element={<OnboardingWizardScreen />} />
      <Route element={<ConfigGate />}>
        <Route element={<TabsLayout />}>
          <Route path="/" element={<AgendaScreen />} />
          <Route path="/buscar" element={<SearchScreen />} />
          <Route path="/catalogo" element={<CatalogHubScreen />} />
          <Route path="/catalogo/zonas" element={<ZonesListScreen />} />
          <Route path="/catalogo/clientes" element={<ClientsListScreen />} />
          <Route path="/catalogo/lotes" element={<FieldsListScreen />} />
        </Route>
        <Route path="/field/:fieldId/record" element={<RecordVisitScreen />} />
        <Route path="/registrar" element={<RecordVisitScreen />} />
        <Route path="/field/:fieldId/visitas" element={<FieldHistoryScreen />} />
        <Route path="/field/:fieldId/visitas/:visitId" element={<VisitDetailScreen />} />
        <Route path="/field/:fieldId/programar" element={<ScheduledVisitFormScreen />} />
        <Route path="/programar" element={<ScheduledVisitFormScreen />} />
        <Route path="/field/:fieldId/programar/:visitId" element={<ScheduledVisitFormScreen />} />
        <Route path="/catalogo/zonas/nueva" element={<ZoneFormScreen />} />
        <Route path="/catalogo/zonas/:id" element={<ZoneFormScreen />} />
        <Route path="/catalogo/clientes/nuevo" element={<ClientFormScreen />} />
        <Route path="/catalogo/clientes/:id" element={<ClientFormScreen />} />
        <Route path="/catalogo/lotes/nuevo" element={<FieldFormScreen />} />
        <Route path="/catalogo/lotes/:id" element={<FieldFormScreen />} />
      </Route>
      </Routes>
    </>
  );
}
