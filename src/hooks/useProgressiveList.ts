/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useIsMobileViewport } from "./useIsMobileViewport";

const MOBILE_LIST_INITIAL = 28;
const MOBILE_LIST_BATCH = 24;
const DESKTOP_LIST_INITIAL = 80;
const DESKTOP_LIST_BATCH = 60;

export function useProgressiveList<T>(items: T[], resetKey: string | number) {
  const isMobile = useIsMobileViewport();
  const initialLimit = isMobile ? MOBILE_LIST_INITIAL : DESKTOP_LIST_INITIAL;
  const batchSize = isMobile ? MOBILE_LIST_BATCH : DESKTOP_LIST_BATCH;
  const [limit, setLimit] = useState(initialLimit);

  useEffect(() => {
    setLimit(initialLimit);
  }, [initialLimit, resetKey]);

  const visibleItems = useMemo(() => items.slice(0, limit), [items, limit]);
  const hasMore = limit < items.length;
  const remaining = Math.max(0, items.length - limit);
  const showMore = useCallback(() => {
    setLimit((currentLimit) =>
      Math.min(items.length, currentLimit + batchSize),
    );
  }, [batchSize, items.length]);

  return { visibleItems, hasMore, remaining, showMore };
}
