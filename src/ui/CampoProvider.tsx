import { createContext, useContext, type ReactNode } from 'react';
import type { Container } from '@/composition/container';

const CampoContext = createContext<Container | null>(null);

export function CampoProvider({ container, children }: { container: Container; children: ReactNode }) {
  return <CampoContext.Provider value={container}>{children}</CampoContext.Provider>;
}

export function useCampo(): Container {
  const container = useContext(CampoContext);
  if (!container) throw new Error('useCampo must be used within a CampoProvider');
  return container;
}
