"use client";

import { useEffect, useState, useRef } from "react";

interface CountdownTimerProps {
  expiresAt: string; // ISO string
  onExpire?: () => void;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function CountdownTimer({ expiresAt, onExpire }: CountdownTimerProps) {
  const expiry = useRef(new Date(expiresAt).getTime());
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const getRemaining = () => {
    const diff = Math.max(0, expiry.current - Date.now());
    return diff;
  };

  const [remaining, setRemaining] = useState(getRemaining());
  const [fired, setFired] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const r = getRemaining();
      setRemaining(r);
      if (r === 0 && !fired) {
        setFired(true);
        onExpireRef.current?.();
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  const isUrgent = remaining < 60000 && remaining > 0; // < 1 minute
  const isExpired = remaining === 0;

  // Progress ring
  const totalMs = 10 * 60 * 1000;
  const progress = Math.max(0, Math.min(1, remaining / totalMs));
  const circumference = 2 * Math.PI * 44; // r=44
  const strokeDashoffset = circumference * (1 - progress);

  const ringColor = isExpired
    ? "oklch(0.65 0.23 25)" // red
    : isUrgent
    ? "oklch(0.75 0.18 55)" // amber
    : "oklch(0.65 0.22 270)"; // indigo

  return (
    <div className="flex flex-col items-center gap-3">
      {/* SVG ring */}
      <div className="relative w-28 h-28">
        <svg
          className="w-full h-full -rotate-90"
          viewBox="0 0 100 100"
        >
          {/* Track */}
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke="oklch(0.25 0.03 255)"
            strokeWidth="8"
          />
          {/* Progress */}
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke={ringColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{
              transition: "stroke-dashoffset 1s linear, stroke 0.5s ease",
              filter: `drop-shadow(0 0 6px ${ringColor})`,
            }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {isExpired ? (
            <span className="text-destructive font-bold text-sm">Expired</span>
          ) : (
            <>
              <span
                className={`text-2xl font-bold tabular-nums ${
                  isUrgent ? "timer-urgent" : ""
                }`}
                style={{ color: ringColor }}
              >
                {pad(minutes)}:{pad(seconds)}
              </span>
              <span className="text-xs text-muted-foreground">remaining</span>
            </>
          )}
        </div>
      </div>

      {/* Status label */}
      <p
        className={`text-sm font-medium text-center ${
          isExpired
            ? "text-destructive"
            : isUrgent
            ? "text-amber-400"
            : "text-muted-foreground"
        }`}
      >
        {isExpired
          ? "Your reservation has expired"
          : isUrgent
          ? "⚡ Hurry! Time is running out"
          : "Stock is held while you decide"}
      </p>
    </div>
  );
}
