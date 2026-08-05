import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type FlagValues = Record<string, boolean>;

interface FlagsContextValue {
  values: FlagValues;
  loading: boolean;
}

const FlagsContext = createContext<FlagsContextValue>({ values: {}, loading: true });

export function FlagsProvider({ children, initialFlags }: { children: ReactNode; initialFlags?: FlagValues }) {
  const [flags, setFlags] = useState<FlagValues>(initialFlags ?? {});
  const [loading, setLoading] = useState(initialFlags === undefined);

  useEffect(() => {
    if (initialFlags !== undefined) return;
    let active = true;
    fetch('/api/flags')
      .then((response) => (response.ok ? response.json() : {}))
      .then((data) => {
        if (!active) return;
        setFlags(typeof data === 'object' && data !== null ? (data as FlagValues) : {});
      })
      .catch(() => {
        if (active) setFlags({});
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [initialFlags]);

  return <FlagsContext.Provider value={{ values: flags, loading }}>{children}</FlagsContext.Provider>;
}

export function useFlag(name: string): boolean {
  return useContext(FlagsContext).values[name] === true;
}

export function useFlagsLoading(): boolean {
  return useContext(FlagsContext).loading;
}
