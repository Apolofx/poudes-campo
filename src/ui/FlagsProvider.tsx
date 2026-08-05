import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type FlagValues = Record<string, boolean>;

const FlagsContext = createContext<FlagValues>({});

export function FlagsProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<FlagValues>({});

  useEffect(() => {
    let active = true;
    fetch('/api/flags')
      .then((response) => (response.ok ? response.json() : {}))
      .then((data) => {
        if (!active) return;
        setFlags(typeof data === 'object' && data !== null ? (data as FlagValues) : {});
      })
      .catch(() => {
        if (active) setFlags({});
      });
    return () => {
      active = false;
    };
  }, []);

  return <FlagsContext.Provider value={flags}>{children}</FlagsContext.Provider>;
}

export function useFlag(name: string): boolean {
  return useContext(FlagsContext)[name] === true;
}
