import React, { useEffect, useRef, useState } from "react";

// Rolling per-key estimate (ms) of how long a remote load takes, persisted and
// updated via EWMA. Shared (exported) so progress bars AND the zoom-view headers
// can show a time-based ETA even when byte progress is uninformative (e.g. while
// the server is still generating a wide cube). Seeded with sensible defaults.
const LOAD_EST: Record<string, number> = {
    main: 5000,
    brains: 3000,
    zoom1: 4000,
    zoom8: 25000,
    zoom16: 45000,
};
try {
    Object.assign(LOAD_EST, JSON.parse(localStorage.getItem("cellpheno.loadEst") || "{}"));
} catch {
    /* storage unavailable */
}

/** Learned duration estimate (ms) for a load bucket. */
export function getLoadEst(key: string): number {
    return LOAD_EST[key] ?? 4000;
}
/** Fold a finished load's real duration into the learned estimate (EWMA). */
export function recordLoadEst(key: string, durationMs: number): void {
    if (durationMs > 250 && durationMs < 300000) {
        LOAD_EST[key] = Math.round(0.6 * (LOAD_EST[key] ?? durationMs) + 0.4 * durationMs);
        try {
            localStorage.setItem("cellpheno.loadEst", JSON.stringify(LOAD_EST));
        } catch {
            /* ignore */
        }
    }
}

interface LoadingProgressProps {
    /** Whether the load is in progress. Renders nothing when false. */
    active: boolean;
    /** Short label, e.g. "Loading brain map". */
    label: string;
    /** Bucket key for the learned duration estimate (fallback only). */
    estKey: string;
    /** Inline (in flow) instead of an absolute overlay. */
    inline?: boolean;
    /**
     * Real progress fraction 0..1. When provided, the bar + ETA use REAL
     * download progress instead of the learned estimate. A value of 0 renders an
     * indeterminate (pulsing) bar — e.g. while the server is still generating and
     * no bytes have arrived yet.
     */
    progress?: number;
    /** Real estimated remaining seconds (used when progress is provided and > 0). */
    etaSec?: number;
}

/**
 * Spinner + progress bar + elapsed/ETA for any remote data fetch.
 *
 * Prefers REAL byte progress (`progress`/`etaSec`); falls back to a learned-time
 * *estimate* only when real progress isn't available.
 */
const LoadingProgress: React.FC<LoadingProgressProps> = ({
    active,
    label,
    estKey,
    inline,
    progress,
    etaSec,
}) => {
    const [elapsed, setElapsed] = useState(0);
    const startRef = useRef(0);

    useEffect(() => {
        if (!active) return;
        startRef.current = performance.now();
        setElapsed(0);
        const id = window.setInterval(() => setElapsed(performance.now() - startRef.current), 100);
        return () => {
            window.clearInterval(id);
            // Only feed the learned estimate when we were running on the estimate.
            if (progress === undefined) {
                recordLoadEst(estKey, performance.now() - startRef.current);
            }
        };
        // progress intentionally excluded: we don't want to restart the timer on
        // every byte; it only gates the estimate-learning above.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, estKey]);

    if (!active) return null;

    const real = progress !== undefined;
    const indeterminate = real && progress <= 0;
    let frac: number;
    let etaText: string;
    if (real) {
        frac = Math.max(0, Math.min(progress, 0.999));
        etaText = indeterminate
            ? "preparing on server…"
            : etaSec !== undefined && etaSec > 0.4
              ? `~${Math.ceil(etaSec)}s left`
              : "almost done…";
    } else {
        const est = getLoadEst(estKey);
        // Asymptotic: ~85% at the estimated time, easing toward (never reaching)
        // 100% afterwards, so it never lies "almost there" when the guess is low.
        frac = Math.min(1 - Math.exp((-1.9 * elapsed) / est), 0.98);
        const remain = (est - elapsed) / 1000;
        etaText = remain > 0.4 ? `~${Math.ceil(remain)}s left` : "taking longer than usual…";
    }

    const inner = (
        <div className="flex flex-col items-center justify-center gap-3">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-cyan-400/25 border-t-cyan-400" />
            <div className="text-sm font-medium text-cyan-100">{label}</div>
            <div className="h-1.5 w-52 max-w-[80%] overflow-hidden rounded-full bg-cyan-500/20">
                {indeterminate ? (
                    <div className="h-full w-full animate-pulse rounded-full bg-cyan-400/60" />
                ) : (
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-400 transition-[width] duration-150 ease-out"
                        style={{ width: `${frac * 100}%` }}
                    />
                )}
            </div>
            <div className="text-xs text-cyan-400/80">
                {(elapsed / 1000).toFixed(1)}s elapsed
                {real && !indeterminate ? ` · ${Math.round(frac * 100)}%` : ""} · {etaText}
            </div>
        </div>
    );

    if (inline) return <div className="py-6">{inner}</div>;
    return (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/55 backdrop-blur-sm">
            {inner}
        </div>
    );
};

export default LoadingProgress;
