import { NiivueCanvas, NVROptions, NVRVolume } from "niivue-react";
import { useImmer } from "use-immer";
import { Niivue, SLICE_TYPE, DRAG_MODE } from "@niivue/niivue";
import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
import { MINIO_ORIGIN, ZOOM_API_ORIGIN } from "@/configs/minio";
import LoadingProgress, { getLoadEst, recordLoadEst } from "@/components/LoadingProgress";

// 定义常量和接口
const FIXED_OPTIONS: NVROptions = {
  isNearestInterpolation: true,
  sliceType: SLICE_TYPE.MULTIPLANAR,
  multiplanarForceRender: true,
  multiplanarLayout: 3,
  multiplanarShowRender: 1,
  fontColor: [1, 1, 1, 1],
};

// 放大视图的配置
const ZOOM_OPTIONS: NVROptions = {
  isNearestInterpolation: false,
  sliceType: SLICE_TYPE.MULTIPLANAR,
  multiplanarForceRender: true,
  multiplanarLayout: 3,
  multiplanarShowRender: 1,
  fontColor: [1, 1, 1, 1],
  // Drag pans the (zoomed) 2D slices; the scroll wheel is overridden to zoom
  // (see ZoomCanvas) since the small cubes need magnification, not slice scroll.
  dragMode: DRAG_MODE.pan,
};

// Multi-resolution zoom ladder. A click opens one collapsible view per scale:
// 1x is the detailed cube; 8x/16x are progressively wider context (the single 1x
// cube is too small to read structure). Each scale is one stitched cube (raw +
// segmentation) that the view's own controls drive. Detail first.
const ZOOM_SCALES = [1, 8, 16];
const ZOOM_DETAIL_SCALE = 1;

interface zoomJsonResponse {
  imgUrl: string[];
  nisUrl: string[];
}

// 防抖函数
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function (...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

interface VolumeConfig {
  [key: string]: string;
}

interface ModulateScalarProps {
  volumes: VolumeConfig;
  brainId: string;
}

// 定义CrosshairLocation接口
interface CrosshairLocation {
  mm: number[];
  axCorSag: string;
  vox: number[];
  frac: number[];
  xy: number[];
  values: number[];
  string: string;
}

const cubesz_xy = 5;
const cubesz_z = 3;

// 从后端获取放大视图数据的服务
const fetchZoomVolumes = async (
  coordinates: number[],
  brainId: string,
  scale: number = 1
): Promise<VolumeConfig> => {
  const xStr = (Math.floor(coordinates[0] / cubesz_xy) * cubesz_xy)
    .toString()
    .padStart(3, "0");
  const yStr = (Math.floor(coordinates[1] / cubesz_xy) * cubesz_xy)
    .toString()
    .padStart(3, "0");
  const zStr = (Math.floor(coordinates[2] / cubesz_z) * cubesz_z)
    .toString()
    .padStart(3, "0");

  // On-demand service: ask it which per-tile cubes cover this click; it returns
  // the same {imgUrl, nisUrl} shape, with URLs pointing at its own cube
  // endpoints. Falls back to pre-materialized MinIO cubes when unconfigured.
  const useZoomApi = ZOOM_API_ORIGIN !== "";
  const parentUrl = useZoomApi
    ? ZOOM_API_ORIGIN
    : `${MINIO_ORIGIN}/${`${brainId}zoomin${cubesz_xy}x${cubesz_xy}x${cubesz_z}`.toLowerCase()}`;

  // The density map has an identity affine, so NiiVue's crosshair vox is the
  // volume's native (z, x, y) axis order (the density map was written z,x,y --
  // `zrange,xrange,yrange = np.where(...)` in prepare_nis_to_aws). The zoom
  // endpoints expect in-plane x, in-plane y, depth z, so reorder the click:
  //   x = vox[1], y = vox[2], z = vox[0].
  const apiX = coordinates[1];
  const apiY = coordinates[2];
  const apiZ = coordinates[0];
  const jsonUrl = useZoomApi
    ? `${ZOOM_API_ORIGIN}/zoom/info?brain=${encodeURIComponent(brainId)}` +
      `&x=${apiX}&y=${apiY}&z=${apiZ}&scale=${scale}`
    : `${parentUrl}/json/X${xStr}/Y${yStr}/${brainId}_zoomin_info_${xStr}_${yStr}_${zStr}.json`;

  try {
    // 获取这个json文件内容
    const jsonResponse = await fetch(jsonUrl);
    const jsonData = (await jsonResponse.json()) as zoomJsonResponse;

    const res: { [key: string]: string } = {};

    jsonData.imgUrl.forEach((url) => {
      res[
        url
          .split("/")
          .pop()
          ?.split(".")[0]
          .split("_")
          .slice(1)
          .join("_") as string
      ] = `${parentUrl}${url}`;
    });

    jsonData.nisUrl.forEach((url) => {
      res[
        url
          .split("/")
          .pop()
          ?.split(".")[0]
          .split("_")
          .slice(1)
          .join("_") as string
      ] = `${parentUrl}${url}`;
    });

    return res;
  } catch (error) {
    console.error("Error fetching zoom volumes:", error);
    return {};
  }
};

// ---------------------------------------------------------------------------
// Shared view-control UI. Every view (main + each zoom) shows the same header:
// an optional collapse chevron, a title, layer toggles, and an opacity slider —
// so the controls are consistent and live with the view they affect.
// ---------------------------------------------------------------------------
interface ViewLayer {
  label: string;
  visible: boolean;
  onToggle: (v: boolean) => void;
}

const LayerPill: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({
  label,
  active,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    title={`${active ? "Hide" : "Show"} ${label}`}
    className={`flex items-center gap-1 rounded-full px-2 py-[2px] text-[11px] font-medium transition-colors ${
      active
        ? "bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-400/50"
        : "text-slate-500 ring-1 ring-slate-700 hover:text-slate-300 hover:ring-slate-600"
    }`}
  >
    <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-cyan-400" : "bg-slate-600"}`} />
    {label}
  </button>
);

const OpacitySlider: React.FC<{ value: number; onChange: (v: number) => void; disabled?: boolean }> = ({
  value,
  onChange,
  disabled,
}) => (
  <div className={`flex items-center gap-1.5 ${disabled ? "opacity-40" : ""}`}>
    <span className="text-[10px] uppercase tracking-wider text-slate-500">opacity</span>
    <input
      type="range"
      min={0}
      max={1}
      step={0.05}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-1 w-20 cursor-pointer accent-cyan-400"
    />
    <span className="w-7 text-right text-[10px] tabular-nums text-slate-400">
      {Math.round(value * 100)}%
    </span>
  </div>
);

interface ViewHeaderProps {
  title: string;
  subtitle?: string;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  lockCollapse?: boolean;
  loadingText?: string | null;
  rightInfo?: string;
  layers: ViewLayer[];
  opacity?: number;
  onOpacity?: (v: number) => void;
  opacityDisabled?: boolean;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
}

const ViewHeader: React.FC<ViewHeaderProps> = ({
  title,
  subtitle,
  collapsible,
  collapsed,
  onToggleCollapse,
  lockCollapse,
  loadingText,
  rightInfo,
  layers,
  opacity,
  onOpacity,
  opacityDisabled,
  onZoomIn,
  onZoomOut,
  onZoomReset,
}) => (
  <div className="flex h-9 shrink-0 items-center gap-2 border-b border-cyan-500/15 bg-slate-900/70 px-3 text-xs backdrop-blur">
    {collapsible && (
      <button
        type="button"
        onClick={onToggleCollapse}
        disabled={lockCollapse}
        title={lockCollapse ? "Loading…" : collapsed ? "Expand" : "Collapse"}
        className={`grid h-5 w-5 place-items-center rounded transition ${
          lockCollapse ? "cursor-not-allowed opacity-30" : "text-cyan-300 hover:bg-cyan-500/10"
        }`}
      >
        <span className={`inline-block text-[10px] transition-transform ${collapsed ? "" : "rotate-90"}`}>
          ▶
        </span>
      </button>
    )}
    <span className="h-2 w-2 shrink-0 rounded-full bg-cyan-400 shadow-[0_0_6px] shadow-cyan-400/70" />
    <span className="font-semibold text-cyan-100">{title}</span>
    {subtitle && <span className="text-slate-500">{subtitle}</span>}
    {loadingText && <span className="text-cyan-300/70">· {loadingText}</span>}
    {rightInfo && (
      <span className="hidden truncate font-mono text-[10px] text-slate-500 lg:inline">{rightInfo}</span>
    )}
    <div className="ml-auto flex items-center gap-3">
      {(onZoomIn || onZoomOut) && (
        <div className="flex items-center overflow-hidden rounded-md ring-1 ring-slate-700">
          <button
            type="button"
            onClick={onZoomOut}
            title="Zoom out"
            className="px-1.5 py-[1px] text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-200"
          >
            −
          </button>
          <button
            type="button"
            onClick={onZoomReset}
            title="Reset zoom"
            className="border-x border-slate-700 px-1.5 py-[1px] text-[10px] text-slate-400 hover:bg-cyan-500/10 hover:text-cyan-200"
          >
            ⟳
          </button>
          <button
            type="button"
            onClick={onZoomIn}
            title="Zoom in"
            className="px-1.5 py-[1px] text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-200"
          >
            +
          </button>
        </div>
      )}
      <div className="flex items-center gap-1">
        {layers.map((l) => (
          <LayerPill key={l.label} label={l.label} active={l.visible} onClick={() => l.onToggle(!l.visible)} />
        ))}
      </div>
      {opacity != null && onOpacity && (
        <OpacitySlider value={opacity} onChange={onOpacity} disabled={opacityDisabled} />
      )}
    </div>
  </div>
);

// NiiVue 0.47 does NOT fire onImageLoadStart/End, so we can't rely on them to
// know when a load finishes. Instead detect completion from NiiVue's own state:
// niivue-react awaits loadVolumes, so the decoded volumes land in `nv.volumes`.
// We wait until that list has CHANGED from before this URL set (so stale volumes
// from a previous load aren't mistaken for "done") and carries image data. A
// safety timeout guarantees the overlay never sticks.
function useNiivueReady(
  niivueRef: React.MutableRefObject<Niivue | null>,
  urlSig: string
): boolean {
  const [loading, setLoading] = useState<boolean>(false);
  const seen = useRef<Set<string>>(new Set());
  useEffect(() => {
    const urls = urlSig ? urlSig.split("|").filter(Boolean) : [];
    // Only show the overlay for genuinely new content to load; a pure
    // show/hide toggle (no new URL) must not flash a "loading" spinner.
    const hasNew = urls.some((u) => !seen.current.has(u));
    if (!hasNew) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const names = (nv: Niivue | null) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((nv?.volumes ?? []) as any[]).map((v) => v?.name ?? v?.url).join("|");
    const prevNames = names(niivueRef.current);
    const t0 = performance.now();
    const id = window.setInterval(() => {
      const nv = niivueRef.current;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vols = (nv?.volumes ?? []) as any[];
      const changed = names(nv) !== prevNames;
      const haveData = vols.length > 0 && vols.every((v) => v?.img?.length > 0);
      if ((changed && haveData) || performance.now() - t0 > 120000) {
        urls.forEach((u) => seen.current.add(u));
        setLoading(false);
        window.clearInterval(id);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [urlSig, niivueRef]);
  return loading;
}

// Preserve the original .nii.gz filename so NiiVue can still sniff the format
// after we swap the URL for an in-memory blob: URL (which has no extension).
function filenameFromUrl(u: string): string {
  try {
    const name = new URL(u, window.location.href).pathname.split("/").pop();
    return name || "volume.nii.gz";
  } catch {
    return "volume.nii.gz";
  }
}

interface ProgressiveVolumes {
  volumes: NVRVolume[]; // same volumes with blob: URLs (downloaded) + name
  loading: boolean;
  /** 0..1 real download fraction; 0 while the server is still preparing. */
  progress: number;
  /** Real remaining seconds. */
  etaSec: number;
}

/**
 * Download the volumes ourselves with byte-level progress, then expose them as
 * blob URLs so NiiVue loads them from memory. This gives a REAL progress bar +
 * ETA for the slow remote fetch (and a definitive completion signal), instead of
 * a guess. While the server is generating a cube (no bytes yet) progress is 0
 * (shown as "preparing"); once bytes stream it's accurate.
 */
function useProgressiveVolumes(source: NVRVolume[], estKey = "zoom1"): ProgressiveVolumes {
  const sig = source.map((v) => v.url).join("|");
  // Map source URL -> downloaded blob URL. Re-downloads only when the URL set
  // changes, so changing a volume's opacity/colormap does NOT re-fetch.
  const [blobMap, setBlobMap] = useState<Record<string, string>>({});
  const [prog, setProg] = useState({ loading: false, progress: 0, etaSec: 0 });

  useEffect(() => {
    if (source.length === 0) {
      setBlobMap({});
      setProg({ loading: false, progress: 0, etaSec: 0 });
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    const createdBlobs: string[] = [];
    const received = source.map(() => 0);
    const totals = source.map(() => 0);
    const done = source.map(() => false); // per-cube completion
    const t0 = performance.now();

    setBlobMap({}); // clears -> "not ready" -> empty volumes while downloading
    setProg({ loading: true, progress: 0, etaSec: getLoadEst(estKey) / 1000 });

    const report = () => {
      if (cancelled) return;
      // Per-cube fraction: a finished cube is 1; a cube whose Content-Length isn't
      // known yet (server still generating) is 0. Averaging means the bar can't
      // jump to 100% just because one of several cubes finished -- the old bug
      // that left wide views stuck at "loading 100%".
      const fracs = source.map((_, i) =>
        done[i] ? 1 : totals[i] > 0 ? Math.min(received[i] / totals[i], 0.99) : 0
      );
      const progress = fracs.reduce((a, b) => a + b, 0) / fracs.length;
      // Time-based ETA from the learned per-key estimate -- works even while the
      // server is generating and no bytes have arrived (byte-rate can't).
      const eta = Math.max(0, getLoadEst(estKey) / 1000 - (performance.now() - t0) / 1000);
      setProg({ loading: true, progress, etaSec: eta });
    };

    // Tick so the ETA counts down even with no byte events (server generating).
    const ticker = window.setInterval(report, 400);

    Promise.all(
      source.map(async (v, i): Promise<[string, string]> => {
        if (!v.url || !/^https?:/i.test(v.url)) {
          done[i] = true;
          return [v.url, v.url]; // already blob/other
        }
        const res = await fetch(v.url, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${v.url}`);
        totals[i] = Number(res.headers.get("content-length")) || 0;
        const chunks: Uint8Array[] = [];
        if (res.body && totals[i] > 0) {
          const reader = res.body.getReader();
          for (;;) {
            const { done: d, value } = await reader.read();
            if (d) break;
            chunks.push(value);
            received[i] += value.length;
            report();
          }
        } else {
          const buf = new Uint8Array(await res.arrayBuffer());
          chunks.push(buf);
          received[i] = buf.length;
          totals[i] = buf.length;
        }
        done[i] = true;
        report();
        const blobUrl = URL.createObjectURL(new Blob(chunks));
        createdBlobs.push(blobUrl);
        return [v.url, blobUrl];
      })
    )
      .then((pairs) => {
        if (cancelled) return;
        window.clearInterval(ticker);
        recordLoadEst(estKey, performance.now() - t0);
        setBlobMap(Object.fromEntries(pairs));
        setProg({ loading: false, progress: 1, etaSec: 0 });
      })
      .catch((err) => {
        if (cancelled || err?.name === "AbortError") return;
        window.clearInterval(ticker);
        console.error("Volume download failed:", err);
        setBlobMap(Object.fromEntries(source.map((v) => [v.url, v.url]))); // fall back to direct URLs
        setProg({ loading: false, progress: 1, etaSec: 0 });
      });

    return () => {
      cancelled = true;
      window.clearInterval(ticker);
      controller.abort();
      createdBlobs.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, estKey]);

  // Derive rendered volumes from the CURRENT source props (opacity, colormap, …)
  // + the downloaded blob URL, so control-panel changes apply without a
  // re-download. Empty until every source URL has been fetched.
  const ready =
    source.length > 0 &&
    source.every((v) => !/^https?:/i.test(v.url) || blobMap[v.url] !== undefined);
  const volumes = useMemo(
    () =>
      ready
        ? // Drop hidden (opacity 0) volumes entirely so they disappear from the
          // 3D render too -- NiiVue's volume raycast ignores per-volume 2D
          // opacity, so merely setting opacity 0 leaves them visible in 3D.
          source
            .filter((v) => (v.opacity ?? 1) > 0)
            .map((v) => ({ ...v, url: blobMap[v.url] ?? v.url, name: filenameFromUrl(v.url) }))
        : [],
    [source, blobMap, ready]
  );

  return { volumes, loading: prog.loading, progress: prog.progress, etaSec: prog.etaSec };
}

// 主视图组件
interface MainNiiViewProps {
  volumes: NVRVolume[];
  onLocationChange: (location: CrosshairLocation) => void;
}

const MainNiiView: React.FC<MainNiiViewProps> = React.memo(
  ({ volumes, onLocationChange }) => {
    const niivueRef = useRef<Niivue | null>(null);
    // Download with real progress, then render the in-memory blobs.
    const dl = useProgressiveVolumes(volumes, "main");
    const decoding = useNiivueReady(niivueRef, dl.volumes.map((v) => v.url).join("|"));
    // Screen position (% of the view) of the last click -> "zoomed here" marker.
    const [pick, setPick] = useState<{ x: number; y: number } | null>(null);

    const configNiivue = (nv: Niivue) => {
      niivueRef.current = nv;
      // @ts-expect-error onLocationChange property is not defined in Niivue type definitions
      nv.onLocationChange = onLocationChange;
    };

    // Only place the marker on a genuine tap. A drag (rotating the 3D render or
    // panning a slice) must NOT move it — otherwise the marker chased the cursor.
    const downRef = useRef<{ x: number; y: number } | null>(null);
    const handleDown = (e: React.PointerEvent<HTMLDivElement>) => {
      downRef.current = { x: e.clientX, y: e.clientY };
    };
    const handlePick = (e: React.PointerEvent<HTMLDivElement>) => {
      const d = downRef.current;
      downRef.current = null;
      if (!d) return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return; // drag, not a click
      const r = e.currentTarget.getBoundingClientRect();
      if (!r.width || !r.height) return;
      setPick({
        x: ((e.clientX - r.left) / r.width) * 100,
        y: ((e.clientY - r.top) / r.height) * 100,
      });
    };

    return (
      <div className="relative flex-1 h-full" onPointerDown={handleDown} onPointerUp={handlePick}>
        <NiivueCanvas volumes={dl.volumes} options={FIXED_OPTIONS} onStart={configNiivue} />
        {pick && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${pick.x}%`, top: `${pick.y}%` }}
          >
            <span className="absolute left-1/2 top-1/2 inline-flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-cyan-400/30" />
            <span className="block h-4 w-4 rounded-full border-2 border-cyan-100 bg-cyan-400/50 shadow-[0_0_10px_2px_rgba(34,211,238,0.6)]" />
            <span className="absolute left-1/2 top-4 -translate-x-1/2 whitespace-nowrap rounded border border-cyan-500/40 bg-slate-900/85 px-1.5 py-0.5 text-[10px] font-medium text-cyan-200">
              zoomed here ↓
            </span>
          </div>
        )}
        <LoadingProgress
          active={dl.loading || decoding}
          label={dl.loading ? "Loading brain map" : "Rendering brain map"}
          estKey="main"
          progress={dl.loading ? dl.progress : 0.99}
          etaSec={dl.loading ? dl.etaSec : 0}
        />
      </div>
    );
  }
);

// 放大视图组件: one collapsible multi-resolution view (its own raw/seg controls).
interface ZoomViewCtl {
  raw: boolean;
  seg: boolean;
  segOpacity: number;
}
interface ZoomViewProps {
  scale: number;
  rawUrl: string | null;
  nisUrl: string | null;
  collapsed: boolean;
  ctl: ZoomViewCtl;
  coordLabel: string;
  onToggleCollapse: () => void;
  onCtl: (patch: Partial<ZoomViewCtl>) => void;
}

// niivue-react never frees the WebGL context on unmount, so collapsing a view
// (which unmounts its canvas) would leak a context; enough collapse/expand cycles
// hit Chrome's ~16-context cap and blank other views. Free it explicitly here.
const ZoomCanvas: React.FC<{ volumes: NVRVolume[]; niivueRef: React.MutableRefObject<Niivue | null> }> =
  ({ volumes, niivueRef }) => {
    const cleanupWheelRef = useRef<(() => void) | null>(null);
    useEffect(() => {
      return () => {
        cleanupWheelRef.current?.();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const gl = (niivueRef.current as any)?.gl as WebGL2RenderingContext | undefined;
        gl?.getExtension("WEBGL_lose_context")?.loseContext();
        niivueRef.current = null;
      };
    }, [niivueRef]);

    const onStart = (nv: Niivue) => {
      niivueRef.current = nv;
      // Plain scroll keeps NiiVue's behaviour (move through 2D slices). Ctrl/⌘ +
      // scroll zooms the 2D view instead; drag pans (dragMode = pan). Capture
      // phase so we run before NiiVue's wheel handler and can suppress its slice
      // scroll only for the zoom gesture.
      const canvas = nv.canvas;
      if (canvas && !cleanupWheelRef.current) {
        const onWheel = (e: WheelEvent) => {
          if (!(e.ctrlKey || e.metaKey)) return; // let NiiVue scroll slices
          e.preventDefault();
          e.stopPropagation();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cur = (nv.scene as any)?.pan2Dxyzmm
            ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
              Array.from((nv.scene as any).pan2Dxyzmm as number[])
            : [0, 0, 0, 1];
          const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
          cur[3] = Math.max(1, Math.min((cur[3] || 1) * factor, 12)); // zoom 1x..12x
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (nv as any).setPan2Dxyzmm(cur);
        };
        canvas.addEventListener("wheel", onWheel, { passive: false, capture: true });
        cleanupWheelRef.current = () =>
          canvas.removeEventListener("wheel", onWheel, { capture: true } as EventListenerOptions);
      }
    };

    return <NiivueCanvas volumes={volumes} options={ZOOM_OPTIONS} onStart={onStart} />;
  };

const ZoomView: React.FC<ZoomViewProps> = React.memo(
  ({ scale, rawUrl, nisUrl, collapsed, ctl, coordLabel, onToggleCollapse, onCtl }) => {
    const niivueRef = useRef<Niivue | null>(null);
    // Source volumes; opacity drives visibility (downloaded regardless so toggles
    // are instant, and a hidden volume is dropped from the render in 3D too).
    const source = useMemo(() => {
      const arr: NVRVolume[] = [];
      if (rawUrl) arr.push({ url: rawUrl, colormap: "gray", opacity: ctl.raw ? 1 : 0 });
      if (nisUrl)
        arr.push({ url: nisUrl, colormap: "roi_i256", opacity: ctl.seg ? ctl.segOpacity : 0 });
      return arr;
    }, [rawUrl, nisUrl, ctl.raw, ctl.seg, ctl.segOpacity]);

    // Prefetch runs even when collapsed, so the cube loads in the background.
    const dl = useProgressiveVolumes(source, `zoom${scale}`);
    const decoding = useNiivueReady(niivueRef, collapsed ? "" : dl.volumes.map((v) => v.url).join("|"));
    // While the cube is still downloading a collapsed view can't be expanded.
    const lockExpand = collapsed && dl.loading;

    // 2D zoom of the slices (drag pans). reset returns to fit.
    const applyZoom = useCallback((mutate: (z: number) => number) => {
      const nv = niivueRef.current;
      if (!nv) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cur = (nv.scene as any)?.pan2Dxyzmm
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          Array.from((nv.scene as any).pan2Dxyzmm as number[])
        : [0, 0, 0, 1];
      cur[3] = Math.max(1, Math.min(mutate(cur[3] || 1), 12));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (nv as any).setPan2Dxyzmm(cur);
    }, []);

    return (
      <div
        className={`flex flex-col overflow-hidden rounded-xl bg-slate-900/40 ring-1 ring-cyan-500/15 ${
          collapsed ? "shrink-0" : "min-h-0 flex-1"
        }`}
      >
        <ViewHeader
          collapsible
          collapsed={collapsed}
          onToggleCollapse={onToggleCollapse}
          lockCollapse={lockExpand}
          title={`${scale}×`}
          subtitle={scale === ZOOM_DETAIL_SCALE ? "detail" : "context"}
          loadingText={
            dl.loading
              ? `loading ${Math.round((dl.progress || 0) * 100)}%` +
                (dl.etaSec > 0.4 ? ` · ~${Math.ceil(dl.etaSec)}s` : " · finishing…")
              : null
          }
          rightInfo={collapsed ? undefined : coordLabel}
          layers={[
            { label: "Raw", visible: ctl.raw, onToggle: (v) => onCtl({ raw: v }) },
            { label: "Seg", visible: ctl.seg, onToggle: (v) => onCtl({ seg: v }) },
          ]}
          opacity={ctl.segOpacity}
          onOpacity={(v) => onCtl({ segOpacity: v })}
          opacityDisabled={!ctl.seg}
          onZoomIn={collapsed ? undefined : () => applyZoom((z) => z * 1.3)}
          onZoomOut={collapsed ? undefined : () => applyZoom((z) => z / 1.3)}
          onZoomReset={collapsed ? undefined : () => applyZoom(() => 1)}
        />

        {!collapsed && (
          <div className="relative flex-1 min-h-0">
            {dl.volumes.length > 0 && <ZoomCanvas volumes={dl.volumes} niivueRef={niivueRef} />}
            {!dl.loading && !decoding && dl.volumes.length > 0 && (
              <div className="pointer-events-none absolute bottom-1.5 right-2 rounded bg-slate-900/60 px-1.5 py-0.5 text-[10px] text-slate-400">
                scroll: slices · drag: pan · +/− (or ⌘-scroll): zoom
              </div>
            )}
            <LoadingProgress
              active={dl.loading || decoding}
              label={dl.loading ? `Loading ${scale}× cube` : "Rendering"}
              estKey={`zoom${scale}`}
              progress={dl.loading ? dl.progress : 0.99}
              etaSec={dl.loading ? dl.etaSec : 0}
            />
          </div>
        )}
      </div>
    );
  }
);

// 主容器组件
const ModulateScalar: React.FC<ModulateScalarProps> = ({
  volumes: volumeUrls,
  brainId,
}) => {
  // 主视图的体积
  const [mainVolumes, setMainVolumes] = useImmer<{ [key: string]: NVRVolume }>(
    () => {
      const initialVolumes: { [key: string]: NVRVolume } = {};

      // 排序处理，将nrrd结尾的文件放在最后
      const volumeUrlsArray = Object.entries(volumeUrls).map(([key, url]) => ({
        key,
        url,
      }));

      volumeUrlsArray.sort((a, b) => {
        if (a.url.toLowerCase().endsWith(".nrrd")) return 1;
        if (b.url.toLowerCase().endsWith(".nrrd")) return -1;
        return 0;
      });

      const volumeUrlsNew = Object.fromEntries(
        volumeUrlsArray.map(({ key, url }) => [key, url])
      );

      // 初始化所有体积
      Object.entries(volumeUrlsNew).forEach(([key, url]) => {
        const lower = url.toLowerCase();
        // Grayscale for continuous background/density volumes; label colormap otherwise.
        const isGrayscale = lower.includes("samplebrain") || lower.includes("/densitymap/");
        const colormap = isGrayscale ? "gray" : "roi_i256";

        initialVolumes[key] = {
          url,
          colormap,
          opacity: 1, // 默认所有的opacity为1
        };
      });

      return initialVolumes;
    }
  );

  // One zoom view per scale: the stitched raw/nis cube URLs + collapsed flag.
  const [zoomViews, setZoomViews] = useImmer<
    Record<number, { raw: string | null; nis: string | null; collapsed: boolean }>
  >({});
  // Per-view controls (raw/seg visibility + segmentation opacity).
  const [zoomCtl, setZoomCtl] = useImmer<Record<number, ZoomViewCtl>>({});

  // 位置信息
  const [location, setLocation] = useState<CrosshairLocation | null>(null);

  // /zoom/info fetch in flight.
  const [isLoadingZoom, setIsLoadingZoom] = useState(false);

  // Dedup: skip refetching the same clicked coordinate.
  const currentRequestRef = useRef<string | null>(null);

  // Fetch one stitched cube per scale and open the views (1x expanded, rest
  // collapsed). Each ZoomView downloads its own cube with progress.
  const fetchZoomData = useCallback(
    async (coordinates: number[]) => {
      const coordinatesKey = coordinates.join("_");
      if (coordinatesKey === currentRequestRef.current) return; // dedup
      currentRequestRef.current = coordinatesKey;
      setIsLoadingZoom(true);
      try {
        const results = await Promise.all(
          ZOOM_SCALES.map(async (scale) => {
            const cfg = await fetchZoomVolumes(coordinates, brainId, scale);
            let raw: string | null = null;
            let nis: string | null = null;
            Object.entries(cfg).forEach(([key, u]) => {
              if (key.includes("rawImage")) raw = u;
              else if (key.includes("nis")) nis = u;
            });
            return { scale, raw, nis };
          })
        );
        // Stale-request guard: a newer click superseded this one.
        if (currentRequestRef.current !== coordinatesKey) return;
        if (results.every((r) => !r.raw && !r.nis)) {
          setZoomViews((draft) => {
            Object.keys(draft).forEach((k) => delete draft[Number(k)]);
          });
          return;
        }
        setZoomViews((draft) => {
          // Preserve the user's collapse choices across clicks (default only on
          // first open).
          const prevCollapsed: Record<number, boolean> = {};
          Object.keys(draft).forEach((k) => {
            prevCollapsed[Number(k)] = draft[Number(k)].collapsed;
            delete draft[Number(k)];
          });
          for (const { scale, raw, nis } of results) {
            draft[scale] = {
              raw,
              nis,
              collapsed: prevCollapsed[scale] ?? scale !== ZOOM_DETAIL_SCALE,
            };
          }
        });
        setZoomCtl((draft) => {
          for (const scale of ZOOM_SCALES) {
            if (!draft[scale]) draft[scale] = { raw: true, seg: true, segOpacity: 0.6 };
          }
        });
      } catch (error) {
        console.error("Error fetching zoom volumes:", error);
        currentRequestRef.current = null; // allow retry of this coordinate
      } finally {
        setIsLoadingZoom(false);
      }
    },
    [brainId, setZoomViews, setZoomCtl]
  );

  // 防抖处理的位置变化函数 (rapid clicks just supersede; in-flight downloads abort)
  const debouncedFetchZoomData = useMemo(
    () => debounce((coordinates: number[]) => fetchZoomData(coordinates), 300),
    [fetchZoomData]
  );

  // 处理位置变化
  const handleLocationChange = useCallback(
    (newLocation: CrosshairLocation) => {
      setLocation(newLocation);
      if (newLocation && newLocation.vox && newLocation.vox.length >= 3) {
        debouncedFetchZoomData(newLocation.vox);
      }
    },
    [debouncedFetchZoomData]
  );

  // 处理主视图体积变化
  const handleMainVolumeChange = useCallback(
    (key: string, changes: Partial<NVRVolume>) => {
      setMainVolumes((draft) => {
        Object.assign(draft[key], changes);
      });
    },
    [setMainVolumes]
  );

  // 将体积对象转换为数组
  const mainVolumesArray = useMemo(
    () => Object.values(mainVolumes),
    [mainVolumes]
  );

  const hasZoom = useMemo(
    () => ZOOM_SCALES.some((s) => zoomViews[s] && (zoomViews[s].raw || zoomViews[s].nis)),
    [zoomViews]
  );

  const toggleCollapse = useCallback(
    (scale: number) => {
      setZoomViews((draft) => {
        if (draft[scale]) draft[scale].collapsed = !draft[scale].collapsed;
      });
    },
    [setZoomViews]
  );

  const patchCtl = useCallback(
    (scale: number, patch: Partial<ZoomViewCtl>) => {
      setZoomCtl((draft) => {
        draft[scale] = { ...(draft[scale] ?? { raw: true, seg: true, segOpacity: 0.6 }), ...patch };
      });
    },
    [setZoomCtl]
  );

  // Deep link: `?loc=x,y,z` (map voxel) auto-opens the zoom there once mounted,
  // so a location is shareable — and it's how the views get exercised in headless
  // tests (NiiVue ignores synthetic canvas clicks).
  useEffect(() => {
    const q = window.location.hash.split("?")[1] ?? window.location.search.slice(1);
    const loc = new URLSearchParams(q).get("loc");
    if (!loc) return;
    const v = loc.split(",").map(Number);
    if (v.length >= 3 && v.every((n) => Number.isFinite(n))) {
      const t = window.setTimeout(() => fetchZoomData(v), 1500);
      return () => window.clearTimeout(t);
    }
  }, [fetchZoomData]);

  const zoomCoordLabel =
    location?.vox && location.vox.length >= 3
      ? `(${location.vox.slice(0, 3).map((v) => Math.round(v)).join(", ")})`
      : "";

  return (
    <div className="flex h-screen flex-col gap-2 overflow-hidden bg-slate-950 p-2">
      {/* Main view card (its controls mirror the zoom views) */}
      <div
        className={`flex flex-col overflow-hidden rounded-xl bg-slate-900/40 ring-1 ring-cyan-500/15 ${
          hasZoom ? "h-1/2" : "flex-1"
        }`}
      >
        <ViewHeader
          title="Main view"
          subtitle="brain density"
          rightInfo={location?.string}
          layers={Object.entries(mainVolumes).map(([key, vol]) => ({
            label: key.charAt(0).toUpperCase() + key.slice(1),
            visible: (vol.opacity ?? 0) > 0,
            onToggle: (vis) => handleMainVolumeChange(key, { opacity: vis ? 1 : 0 }),
          }))}
          opacity={Object.values(mainVolumes)[0]?.opacity ?? 1}
          onOpacity={(v) => {
            const k = Object.keys(mainVolumes)[0];
            if (k) handleMainVolumeChange(k, { opacity: v });
          }}
        />
        <div className="relative min-h-0 flex-1">
          <MainNiiView volumes={mainVolumesArray} onLocationChange={handleLocationChange} />
          {!hasZoom && (
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-cyan-500/30 bg-slate-900/85 px-3 py-1 text-xs text-cyan-200/90 shadow-lg">
              {isLoadingZoom ? "Locating zoom…" : "Click the brain to open 1× / 8× / 16× zoom views"}
            </div>
          )}
        </div>
      </div>

      {/* Zoom views: collapsible 1× / 8× / 16× accordion */}
      {hasZoom && (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          {ZOOM_SCALES.map((scale) => {
            const v = zoomViews[scale];
            if (!v || (!v.raw && !v.nis)) return null;
            return (
              <ZoomView
                key={scale}
                scale={scale}
                rawUrl={v.raw}
                nisUrl={v.nis}
                collapsed={v.collapsed}
                ctl={zoomCtl[scale] ?? { raw: true, seg: true, segOpacity: 0.6 }}
                coordLabel={zoomCoordLabel}
                onToggleCollapse={() => toggleCollapse(scale)}
                onCtl={(patch) => patchCtl(scale, patch)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ModulateScalar;
