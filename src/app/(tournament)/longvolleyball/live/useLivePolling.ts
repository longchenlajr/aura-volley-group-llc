"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export function useLivePolling<T>(
  url: string | null,
  intervalMs: number = 12000,
  enabled: boolean = true,
): {
  data: T | null;
  error: string | null;
  loading: boolean;
  lastUpdated: Date | null;
  refresh: () => void;
  fetching: boolean;
} {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [fetching, setFetching] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const fetchData = useCallback(async () => {
    if (!url || !enabledRef.current) return;
    setFetching(true);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fetch failed");
    } finally {
      setFetching(false);
      setLoading(false);
    }
  }, [url]);

  // Initial fetch — only set loading on first load, don't flash on URL change
  useEffect(() => {
    if (!url || !enabled) {
      setLoading(false);
      if (!url) setData(null); // Only clear data when URL is explicitly null
      return;
    }
    if (!data) setLoading(true); // Only show loading if we have no data yet
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, enabled]);

  // Polling interval
  useEffect(() => {
    if (!url || !enabled) return;

    function startPolling() {
      intervalRef.current = setInterval(() => {
        if (enabledRef.current && document.visibilityState === "visible") {
          fetchData();
        }
      }, intervalMs);
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        fetchData(); // Immediate refresh on tab focus
        if (!intervalRef.current) startPolling();
      } else {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    }

    startPolling();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [url, enabled, intervalMs, fetchData]);

  return { data, error, loading, lastUpdated, refresh: fetchData, fetching };
}
