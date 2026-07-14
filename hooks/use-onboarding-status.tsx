import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import { getItem, runMigrations, setItem } from '@/lib/storage';

type OnboardingStatus = {
  isLoading: boolean;
  isOnboarded: boolean;
  completeOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
};

const OnboardingContext = createContext<OnboardingStatus | null>(null);

// Owns the hasOnboarded flag that drives the Stack.Protected gate in
// app/_layout.tsx: completeOnboarding() flips context state, which re-renders
// the gate and routes to (tabs) without any manual router.replace.
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isOnboarded, setIsOnboarded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Migrations run here because this is the first storage access on every launch.
      await runMigrations();
      const flag = await getItem('hasOnboarded');
      if (!cancelled) {
        setIsOnboarded(flag === true);
        setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const completeOnboarding = useCallback(async () => {
    await setItem('hasOnboarded', true);
    setIsOnboarded(true);
  }, []);

  const resetOnboarding = useCallback(async () => {
    await setItem('hasOnboarded', false);
    setIsOnboarded(false);
  }, []);

  return (
    <OnboardingContext.Provider
      value={{ isLoading, isOnboarded, completeOnboarding, resetOnboarding }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboardingStatus(): OnboardingStatus {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error('useOnboardingStatus must be used inside OnboardingProvider');
  }
  return ctx;
}
