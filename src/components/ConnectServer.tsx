import React from "react";
import { Modal, Input, Form, Typography, Alert } from "antd";
import { Server } from "lucide-react";
import {
    getServerConfig,
    saveServerConfig,
    resetServerConfig,
    hasServerOverride,
    type ServerConfig,
} from "@/configs/minio";

type TestState =
    | { status: "idle" }
    | { status: "testing" }
    | { status: "ok"; detail: string }
    | { status: "error"; detail: string };

// NOTE: buttons here are plain Tailwind <button>s, not antd <Button>s. antd v5
// styles buttons with `:where(.ant-btn)` (zero specificity), which Tailwind's
// Preflight `button { background: transparent }` overrides -> antd buttons render
// invisible. Tailwind utility bg-* classes (utilities layer) win over Preflight.

const btnBase =
    "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

/**
 * "Connect to cellpheno server" dialog: point the viewer at a backend on the
 * user's own node at runtime (persisted in localStorage; saving reloads).
 */
const ConnectServer: React.FC = () => {
    const [open, setOpen] = React.useState(false);
    const [cfg, setCfg] = React.useState<ServerConfig>(getServerConfig);
    const [test, setTest] = React.useState<TestState>({ status: "idle" });
    const overridden = hasServerOverride();

    const openDialog = () => {
        setCfg(getServerConfig());
        setTest({ status: "idle" });
        setOpen(true);
    };

    const update = (patch: Partial<ServerConfig>) => {
        setCfg((c) => ({ ...c, ...patch }));
        setTest({ status: "idle" });
    };

    const testConnection = async () => {
        const origin = cfg.zoomApiOrigin.trim().replace(/\/+$/, "");
        if (!origin) {
            setTest({ status: "error", detail: "Enter a zoom service origin to test." });
            return;
        }
        setTest({ status: "testing" });
        try {
            const res = await fetch(`${origin}/healthz`, { method: "GET" });
            if (!res.ok) {
                setTest({ status: "error", detail: `HTTP ${res.status} from ${origin}/healthz` });
                return;
            }
            const body = await res.json().catch(() => ({}));
            const backend = body?.tiff_backend ? ` · backend: ${body.tiff_backend}` : "";
            setTest({ status: "ok", detail: `Connected${backend}` });
        } catch {
            setTest({
                status: "error",
                detail:
                    `Could not reach ${origin}. If this page is HTTPS and the server is plain ` +
                    `HTTP, the browser blocks it (mixed content) — use an https:// origin or an ` +
                    `SSH tunnel to http://localhost.`,
            });
        }
    };

    const save = () => {
        saveServerConfig(cfg);
        window.location.reload();
    };

    const reset = () => {
        resetServerConfig();
        window.location.reload();
    };

    return (
        <>
            <button
                type="button"
                onClick={openDialog}
                className="inline-flex items-center gap-1.5 rounded-md border border-cyan-500/60 px-3 py-1.5 text-sm font-medium text-cyan-300 transition-colors hover:bg-cyan-500 hover:text-slate-900"
            >
                <Server size={16} />
                {overridden ? "Server (custom)" : "Connect to server"}
            </button>

            <Modal
                title="Connect to cellpheno server"
                open={open}
                onCancel={() => setOpen(false)}
                footer={
                    <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={reset}
                            disabled={!overridden}
                            className={`${btnBase} border border-red-300 text-red-600 hover:bg-red-50`}
                        >
                            Reset to default
                        </button>
                        <button
                            type="button"
                            onClick={testConnection}
                            disabled={test.status === "testing"}
                            className={`${btnBase} border border-slate-300 text-slate-700 hover:bg-slate-100`}
                        >
                            {test.status === "testing" ? "Testing…" : "Test connection"}
                        </button>
                        <button
                            type="button"
                            onClick={save}
                            className={`${btnBase} bg-blue-600 text-white hover:bg-blue-700`}
                        >
                            Save &amp; reconnect
                        </button>
                    </div>
                }
            >
                <Typography.Paragraph type="secondary">
                    Point this viewer at a backend running on your node. Values are stored in this
                    browser; saving reloads the page.
                </Typography.Paragraph>

                <Form layout="vertical">
                    <Form.Item
                        label="On-demand zoom service origin"
                        help="nis_ondemand_viewer, e.g. http://localhost:8090. Serves the brain list, density maps and zoom cubes."
                    >
                        <Input
                            placeholder="http://localhost:8090"
                            value={cfg.zoomApiOrigin}
                            onChange={(e) => update({ zoomApiOrigin: e.target.value })}
                            allowClear
                        />
                    </Form.Item>
                    <Form.Item
                        label="MinIO origin (optional)"
                        help="Only needed if not using the zoom service for the brain list."
                    >
                        <Input
                            placeholder="http://localhost:8080"
                            value={cfg.minioOrigin}
                            onChange={(e) => update({ minioOrigin: e.target.value })}
                        />
                    </Form.Item>
                    <Form.Item label="MinIO bucket">
                        <Input
                            placeholder="brainmapp14"
                            value={cfg.minioBucket}
                            onChange={(e) => update({ minioBucket: e.target.value })}
                        />
                    </Form.Item>
                </Form>

                {test.status === "ok" && <Alert type="success" showIcon message={test.detail} />}
                {test.status === "error" && <Alert type="error" showIcon message={test.detail} />}
            </Modal>
        </>
    );
};

export default ConnectServer;
