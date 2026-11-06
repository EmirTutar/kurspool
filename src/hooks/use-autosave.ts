"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AutosaveState = "idle" | "pending" | "saving" | "saved" | "failed";

/**
 * Saves a short while after the last change, and right away on blur or when the page is hidden.
 * Saves never overlap: changes made while one runs are saved right after it.
 */
export function useAutosave(save: () => Promise<boolean>, delay = 800) {
  const [state, setState] = useState<AutosaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const running = useRef<Promise<void> | null>(null);
  const dirty = useRef(false);
  const saveRef = useRef(save);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const run = useCallback((): Promise<void> => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (running.current) return running.current;
    if (!dirty.current) return Promise.resolve();

    const work = async () => {
      while (dirty.current) {
        dirty.current = false;
        setState("saving");
        const ok = await saveRef.current();
        // After a failure the next change tries again, so a broken connection doesn't loop.
        if (!ok) {
          setState("failed");
          return;
        }
        setState(dirty.current ? "pending" : "saved");
      }
    };
    running.current = work().finally(() => {
      running.current = null;
    });
    return running.current;
  }, []);

  const schedule = useCallback(() => {
    dirty.current = true;
    setState("pending");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void run(), delay);
  }, [delay, run]);

  // A reload or a closed tab can't wait for a save, so the browser asks first while one is outstanding.
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty.current || running.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  useEffect(() => {
    const flushNow = () => void run();
    const onHide = () => {
      if (document.visibilityState === "hidden") flushNow();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flushNow);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flushNow);
      // Leaving the page within the wait still saves the last change.
      flushNow();
    };
  }, [run]);

  return { state, schedule, flush: run };
}
