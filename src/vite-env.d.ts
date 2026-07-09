/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_BASE_URL?: string;
    /** Origin of the MinIO / S3 server hosting the NIS results (e.g. http://localhost:8080). */
    readonly VITE_MINIO_ORIGIN?: string;
    /** Bucket holding the whole-brain density maps listed on the home page. */
    readonly VITE_MINIO_BUCKET?: string;
    /** Optional on-demand zoom service origin (nis_ondemand_viewer). */
    readonly VITE_ZOOM_API_ORIGIN?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
