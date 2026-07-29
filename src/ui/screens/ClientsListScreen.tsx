import { CatalogListScreen } from '@/ui/catalog/CatalogListScreen';
import { useClientSection } from '@/ui/catalog/use-client-section';

export function ClientsListScreen() {
  return <CatalogListScreen useSection={useClientSection} />;
}
