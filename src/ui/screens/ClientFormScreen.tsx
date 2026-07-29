import { CatalogFormScreen } from '@/ui/catalog/CatalogFormScreen';
import { useClientSection } from '@/ui/catalog/use-client-section';

export function ClientFormScreen() {
  return <CatalogFormScreen useSection={useClientSection} />;
}
