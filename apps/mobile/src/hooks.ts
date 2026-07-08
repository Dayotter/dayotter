import { useCallback, useEffect, useState } from "react";

interface AsyncResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** Run an async loader on mount, with reload + loading/error state. */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[] = []): AsyncResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(() => {
    let active = true;
    setLoading(true);
    setError(null);
    loader()
      .then((d) => active && setData(d))
      .catch((e) => active && setError(e instanceof Error ? e.message : "Something went wrong"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => run(), [run]);

  return { data, loading, error, reload: run };
}
