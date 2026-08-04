import { useEffect } from 'react';
import { pageview } from '@vercel/analytics';

export function PwaInstallTracker() {
  useEffect(() => {
    const onInstalled = () => pageview({ path: '/__app-installed__' });
    window.addEventListener('appinstalled', onInstalled);
    return () => window.removeEventListener('appinstalled', onInstalled);
  }, []);
  return null;
}
