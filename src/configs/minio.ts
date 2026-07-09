// Central configuration for the cellpheno backend the viewer talks to:
//  - the MinIO / S3 server that hosts the brain list + density maps, and
//  - the optional on-demand zoom service (nis_ondemand_viewer).
//
// Resolution order for each value: a runtime override saved in localStorage (set
// via the "Connect to server" dialog) -> the build-time VITE_* env -> a default.
// The runtime override is what lets a statically hosted build (e.g. GitHub Pages)
// point at a backend running on the user's own node without rebuilding.

const LS_KEYS = {
    zoom: "cellpheno.zoomApiOrigin",
    minio: "cellpheno.minioOrigin",
    bucket: "cellpheno.minioBucket",
} as const;

const lsGet = (key: string): string | null => {
    try {
        return localStorage.getItem(key);
    } catch {
        return null; // e.g. storage disabled
    }
};

// Drop a trailing slash so `${origin}/path` never doubles up.
const normalizeOrigin = (value: string): string => value.trim().replace(/\/+$/, "");

const DEFAULT_MINIO_ORIGIN =
    import.meta.env.VITE_MINIO_ORIGIN ?? `${window.location.protocol}//localhost:8080`;
const DEFAULT_MINIO_BUCKET = import.meta.env.VITE_MINIO_BUCKET ?? "brainmapp14";
const DEFAULT_ZOOM_API_ORIGIN = import.meta.env.VITE_ZOOM_API_ORIGIN ?? "";

export interface ServerConfig {
    /** On-demand zoom service origin (nis_ondemand_viewer). Empty = use MinIO cubes. */
    zoomApiOrigin: string;
    /** MinIO / S3 origin hosting the brain list + density maps. */
    minioOrigin: string;
    /** MinIO bucket holding the whole-brain density maps. */
    minioBucket: string;
}

/** The effective config (runtime override -> env -> default), resolved live. */
export const getServerConfig = (): ServerConfig => ({
    zoomApiOrigin: normalizeOrigin(lsGet(LS_KEYS.zoom) ?? DEFAULT_ZOOM_API_ORIGIN),
    minioOrigin: normalizeOrigin(lsGet(LS_KEYS.minio) || DEFAULT_MINIO_ORIGIN),
    minioBucket: (lsGet(LS_KEYS.bucket) || DEFAULT_MINIO_BUCKET).trim(),
});

/** Persist a runtime override. Callers should reload so module-level consts re-read. */
export const saveServerConfig = (cfg: ServerConfig): void => {
    try {
        localStorage.setItem(LS_KEYS.zoom, normalizeOrigin(cfg.zoomApiOrigin));
        localStorage.setItem(LS_KEYS.minio, normalizeOrigin(cfg.minioOrigin));
        localStorage.setItem(LS_KEYS.bucket, cfg.minioBucket.trim());
    } catch {
        /* storage disabled — overrides simply won't persist */
    }
};

/** Clear the runtime override so the build-time env / defaults apply again. */
export const resetServerConfig = (): void => {
    try {
        Object.values(LS_KEYS).forEach((k) => localStorage.removeItem(k));
    } catch {
        /* ignore */
    }
};

/** True when a runtime override is currently in effect (vs. env/defaults). */
export const hasServerOverride = (): boolean =>
    Object.values(LS_KEYS).some((k) => lsGet(k) !== null);

// Resolved values, read once at module load. The "Connect to server" dialog
// reloads the page after saving so these pick up the new override.
const resolved = getServerConfig();
export const MINIO_ORIGIN = resolved.minioOrigin;
export const MINIO_BUCKET_NAME = resolved.minioBucket;
export const ZOOM_API_ORIGIN = resolved.zoomApiOrigin;
