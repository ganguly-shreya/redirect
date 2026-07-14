import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

// Static web rendering has no color scheme until hydration; return 'light'
// until then so server and client markup match.
export function useColorScheme(): 'light' | 'dark' | null | undefined {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const colorScheme = useRNColorScheme();
  return hasHydrated ? colorScheme : 'light';
}
