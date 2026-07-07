"use client";

import { useCallback, useState } from "react";

type PaginationState = {
  pageIndex: number;
  cursors: (string | null)[];
};

const defaultState = (): PaginationState => ({
  pageIndex: 0,
  cursors: [null],
});

/** Cursor stack for Convex `.paginate()` — reset when `resetKey` changes. */
export function useCursorPagination(resetKey: string, pageSize: number) {
  const [stateByKey, setStateByKey] = useState<Record<string, PaginationState>>({});
  const paginationKey = `${resetKey}:${pageSize}`;
  const state = stateByKey[paginationKey] ?? defaultState();

  const setState = useCallback(
    (updater: PaginationState | ((prev: PaginationState) => PaginationState)) => {
      setStateByKey((prev) => {
        const current = prev[paginationKey] ?? defaultState();
        const next = typeof updater === "function" ? updater(current) : updater;
        return { ...prev, [paginationKey]: next };
      });
    },
    [paginationKey],
  );

  const { pageIndex, cursors } = state;
  const cursor = cursors[pageIndex] ?? null;

  const goNext = useCallback(
    (continueCursor: string | null, isDone: boolean) => {
      if (isDone || continueCursor === null) return;
      setState((prev) => {
        const nextCursors = [...prev.cursors];
        nextCursors[prev.pageIndex + 1] = continueCursor;
        return {
          ...prev,
          cursors: nextCursors,
          pageIndex: prev.pageIndex + 1,
        };
      });
    },
    [setState],
  );

  const goPrev = useCallback(() => {
    setState((prev) => ({ ...prev, pageIndex: Math.max(0, prev.pageIndex - 1) }));
  }, [setState]);

  return {
    pageIndex,
    cursor,
    pageSize,
    canGoPrev: pageIndex > 0,
    goNext,
    goPrev,
    pageNumber: pageIndex + 1,
  };
}
