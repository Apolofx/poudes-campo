import { useEffect } from 'react';
import { useFlag } from '@/ui/FlagsProvider';

export function ThemeGate() {
  const dark = useFlag('darkMode');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }, [dark]);

  return null;
}
