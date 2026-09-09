'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseApiResult<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Generic hook that wraps an async fetcher function with loading/error/refetch states.
 * Pass `enabled: false` or leave the fetcher returning undefined to skip the request.
 */
export function useApi<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
  options?: { enabled?: boolean }
): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchCount, setFetchCount] = useState(0);
  const mountedRef = useRef(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const enabled = options?.enabled ?? true;
  const depsKey = JSON.stringify(deps);

  useEffect(() => {
    mountedRef.current = true;

    if (!enabled) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    fetcherRef.current().then(
      (result) => {
        if (mountedRef.current) {
          setData(result);
          setIsLoading(false);
        }
      },
      (err: unknown) => {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : 'An error occurred');
          setIsLoading(false);
        }
      }
    );

    return () => {
      mountedRef.current = false;
    };
  }, [enabled, depsKey, fetchCount]);

  const refetch = useCallback(() => {
    setFetchCount((c) => c + 1);
  }, []);

  return { data, isLoading, error, refetch };
}

export interface UseMutationResult<TData, TInput> {
  mutate: (input: TInput) => Promise<TData | undefined>;
  data: TData | null;
  isLoading: boolean;
  error: string | null;
  reset: () => void;
}

/**
 * Generic hook for mutation operations (create, update, delete).
 */
export function useMutation<TData, TInput = void>(
  mutationFn: (input: TInput) => Promise<TData>
): UseMutationResult<TData, TInput> {
  const [data, setData] = useState<TData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(
    async (input: TInput): Promise<TData | undefined> => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await mutationFn(input);
        setData(result);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An error occurred';
        setError(message);
        return undefined;
      } finally {
        setIsLoading(false);
      }
    },
    [mutationFn]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return { mutate, data, isLoading, error, reset };
}
