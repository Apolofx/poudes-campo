import { CatalogFormScreen } from '@/ui/catalog/CatalogFormScreen';
import { useZoneSection } from '@/ui/catalog/use-zone-section';

export function ZoneFormScreen() {
  return <CatalogFormScreen useSection={useZoneSection} />;
}
