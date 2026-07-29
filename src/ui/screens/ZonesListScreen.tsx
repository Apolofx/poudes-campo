import { CatalogListScreen } from '@/ui/catalog/CatalogListScreen';
import { useZoneSection } from '@/ui/catalog/use-zone-section';

export function ZonesListScreen() {
  return <CatalogListScreen useSection={useZoneSection} />;
}
