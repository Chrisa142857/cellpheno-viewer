import React from "react";
import { Modal, Input, Form, Typography, Alert, Collapse } from "antd";
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

// The lab backend listens on yukon:8090. This page is served over HTTPS, so a
// plain-HTTP origin would be blocked as mixed content — http://localhost is the
// exception, hence the tunnel rather than pointing straight at yukon.
const YUKON_ORIGIN = "http://localhost:8090";
const ONYEN_PLACEHOLDER = "[Onyen]";

// yukon is only reachable through the raptor jump host, so -J is not optional.
const yukonTunnelCmd = (onyen: string): string => {
    const u = onyen.trim() || ONYEN_PLACEHOLDER;
    return `ssh -N -L 8090:localhost:8090 ${u}@yukon.acm.unc.edu -J ${u}@raptor.acm.unc.edu`;
};

/**
 * "Connect to cellpheno server" dialog: point the viewer at a backend on the
 * user's own node at runtime (persisted in localStorage; saving reloads).
 */
const ConnectServer: React.FC = () => {
    const [open, setOpen] = React.useState(false);
    const [cfg, setCfg] = React.useState<ServerConfig>(getServerConfig);
    const [test, setTest] = React.useState<TestState>({ status: "idle" });
    // Remembered so the ssh line is ready next time, not retyped each visit.
    const [onyen, setOnyen] = React.useState(() => {
        try {
            return localStorage.getItem("cellpheno.onyen") ?? "";
        } catch {
            return "";
        }
    });
    const overridden = hasServerOverride();

    const updateOnyen = (v: string) => {
        setOnyen(v);
        try {
            localStorage.setItem("cellpheno.onyen", v.trim());
        } catch {
            /* storage disabled — the command still works, it just won't persist */
        }
    };

    const openDialog = () => {
        const saved = getServerConfig();
        // Default to the tunnelled origin so the ACMLab path is just: ssh, then
        // Connect & Test. Anything already configured wins.
        setCfg({ ...saved, zoomApiOrigin: saved.zoomApiOrigin || YUKON_ORIGIN });
        setTest({ status: "idle" });
        setOpen(true);
    };

    const update = (patch: Partial<ServerConfig>) => {
        setCfg((c) => ({ ...c, ...patch }));
        setTest({ status: "idle" });
    };

    const testConnection = async (): Promise<boolean> => {
        const origin = cfg.zoomApiOrigin.trim().replace(/\/+$/, "");
        if (!origin) {
            setTest({ status: "error", detail: "Enter a zoom service origin to connect to." });
            return false;
        }
        setTest({ status: "testing" });
        try {
            const res = await fetch(`${origin}/healthz`, { method: "GET" });
            if (!res.ok) {
                setTest({ status: "error", detail: `HTTP ${res.status} from ${origin}/healthz` });
                return false;
            }
            const body = await res.json().catch(() => ({}));
            const backend = body?.tiff_backend ? ` · backend: ${body.tiff_backend}` : "";
            setTest({ status: "ok", detail: `Connected${backend} — reloading…` });
            return true;
        } catch {
            setTest({
                status: "error",
                detail:
                    `Could not reach ${origin}. Check that the SSH tunnel is running. (If this ` +
                    `page is HTTPS and the server is plain HTTP, the browser blocks it — hence ` +
                    `the tunnel to http://localhost.)`,
            });
            return false;
        }
    };

    // Test first, save only if it answered: saving reloads, so a bad origin would
    // otherwise reload into a broken viewer with no clue why.
    const connectAndTest = async () => {
        if (!(await testConnection())) return;
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
                width={640}
                onCancel={() => setOpen(false)}
                footer={
                    <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={reset}
                            disabled={!overridden}
                            className={`${btnBase} border border-red-300 text-red-600 hover:bg-red-50`}
                        >
                            Reset
                        </button>
                        <button
                            type="button"
                            onClick={connectAndTest}
                            disabled={test.status === "testing"}
                            className={`${btnBase} bg-blue-600 text-white hover:bg-blue-700`}
                        >
                            {test.status === "testing" ? "Connecting…" : "Connect & Test"}
                        </button>
                    </div>
                }
            >
                <Typography.Paragraph type="secondary">
                    Point this viewer at a backend running on your node. <b>Connect &amp; Test</b>{" "}
                    checks the server, then stores the settings in this browser and reloads.
                </Typography.Paragraph>

                <Collapse
                    className="mb-4"
                    items={[
                        {
                            key: "acmlab",
                            label: <span className="text-sm font-medium">ACMLab user</span>,
                            children: (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-slate-600">Onyen</span>
                                        <Input
                                            size="small"
                                            placeholder="your onyen"
                                            value={onyen}
                                            onChange={(e) => updateOnyen(e.target.value)}
                                            className="max-w-[160px]"
                                        />
                                    </div>
                                    <div className="text-sm text-slate-600">
                                        Run this on your machine, leave it open, then click{" "}
                                        <b>Connect &amp; Test</b>:
                                    </div>
                                    {/* break-all: the command is ~90 chars and must not
                                        push the copy icon onto its own line. */}
                                    <div className="break-all">
                                        <Typography.Text
                                            code
                                            copyable={{ text: yukonTunnelCmd(onyen) }}
                                            className="!text-xs"
                                        >
                                            {yukonTunnelCmd(onyen)}
                                        </Typography.Text>
                                    </div>
                                </div>
                            ),
                        },
                        {
                            key: "others",
                            label: <span className="text-sm font-medium">Others</span>,
                            children: (
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
                                    <Form.Item label="MinIO bucket" className="!mb-0">
                                        <Input
                                            placeholder="brainmapp14"
                                            value={cfg.minioBucket}
                                            onChange={(e) => update({ minioBucket: e.target.value })}
                                        />
                                    </Form.Item>
                                </Form>
                            ),
                        },
                    ]}
                />

                {test.status === "ok" && <Alert type="success" showIcon message={test.detail} />}
                {test.status === "error" && <Alert type="error" showIcon message={test.detail} />}
            </Modal>
        </>
    );
};

export default ConnectServer;
