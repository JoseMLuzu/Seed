/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Droplets, Pause } from "lucide-react";

export function GestureNoteSurface({
  children,
  className,
  wrapperClassName = "",
  onPress,
  onSwipeRight,
  onSwipeLeft,
  onLongPress,
  rightLabel = "Regar",
  leftLabel = "El cobertizo",
  rightIcon: RightIcon = Droplets,
  leftIcon: LeftIcon = Pause,
  rightTone = "bg-[var(--tone-water)] text-[var(--on-sage)]",
  leftTone = "bg-[var(--tone-warning)] text-[var(--on-sage)]",
}: {
  children: ReactNode;
  className: string;
  wrapperClassName?: string;
  onPress?: () => void;
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  onLongPress?: () => void;
  rightLabel?: string;
  leftLabel?: string;
  rightIcon?: typeof Droplets;
  leftIcon?: typeof Pause;
  rightTone?: string;
  leftTone?: string;
}) {
  const isMobileViewport =
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 767px)").matches;
  const longPressTimerRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);
  const swipedRef = useRef(false);
  const [swipeHint, setSwipeHint] = useState<"right" | "left" | null>(null);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const startLongPress = () => {
    longPressFiredRef.current = false;
    swipedRef.current = false;
    clearLongPressTimer();
    if (!onLongPress || window.innerWidth >= 768) return;

    longPressTimerRef.current = window.setTimeout(() => {
      longPressFiredRef.current = true;
      onLongPress();
    }, 520);
  };

  if (!isMobileViewport) {
    return (
      <div
        className={`relative overflow-hidden bg-[var(--surface-strong)] ${wrapperClassName}`}
      >
        <div
          onClick={() => onPress?.()}
          className={`relative z-10 ${className}`}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden bg-[var(--surface-strong)] ${wrapperClassName}`}
    >
      <AnimatePresence>
        {swipeHint && (
          <motion.div
            aria-hidden="true"
            className={`pointer-events-none absolute top-1/2 z-0 flex h-10 -translate-y-1/2 items-center gap-2 rounded-full px-3 text-xs font-semibold shadow-sm ${
              swipeHint === "right"
                ? `left-3 ${rightTone}`
                : `right-3 ${leftTone}`
            }`}
            initial={{
              opacity: 0,
              scale: 0.86,
              x: swipeHint === "right" ? -8 : 8,
            }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.1 } }}
          >
            {swipeHint === "right" ? (
              <>
                <RightIcon size={15} />
                <span>{rightLabel}</span>
              </>
            ) : (
              <>
                <span>{leftLabel}</span>
                <LeftIcon size={15} />
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.045}
        onPointerDown={startLongPress}
        onPointerUp={() => {
          clearLongPressTimer();
          setSwipeHint(null);
        }}
        onPointerCancel={() => {
          clearLongPressTimer();
          setSwipeHint(null);
        }}
        onPointerLeave={() => {
          clearLongPressTimer();
          setSwipeHint(null);
        }}
        onDragStart={() => {
          clearLongPressTimer();
        }}
        onDrag={(_, info) => {
          const mostlyHorizontal =
            Math.abs(info.offset.x) > Math.abs(info.offset.y) * 1.4;
          if (!mostlyHorizontal || Math.abs(info.offset.x) < 28) {
            setSwipeHint(null);
            return;
          }
          setSwipeHint(info.offset.x > 0 ? "right" : "left");
        }}
        onDragEnd={(_, info) => {
          clearLongPressTimer();
          setSwipeHint(null);
          const mostlyHorizontal =
            Math.abs(info.offset.x) > Math.abs(info.offset.y) * 1.25;
          if (!mostlyHorizontal || Math.abs(info.offset.x) < 74) return;

          swipedRef.current = true;
          if (info.offset.x > 0) onSwipeRight?.();
          else onSwipeLeft?.();
          window.setTimeout(() => {
            swipedRef.current = false;
          }, 160);
        }}
        onClick={() => {
          if (longPressFiredRef.current || swipedRef.current) return;
          onPress?.();
        }}
        className={`relative z-10 ${className}`}
      >
        {children}
      </motion.div>
    </div>
  );
}
