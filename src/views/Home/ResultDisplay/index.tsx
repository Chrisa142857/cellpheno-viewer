import React, {memo, useEffect, useMemo, useState} from "react";
import {useNavigate} from "react-router-dom";
import './index.css';
import {fetchBrainImg} from "@/api";
import useBrainStore from "@/stores/brain.ts";
import {BrainRes} from "@/types/user";
import LoadingProgress from "@/components/LoadingProgress";
// Inline style below, not a Tailwind bg-[url(...)]: an arbitrary Tailwind URL
// can't reference this hashed import.
import backUrl from "@/assets/back.png";

type Status = "loading" | "ready" | "error";

const ResultDisplay: React.FC = () => {
    const setSampleImages = useBrainStore((state) => state.setSampleImages)
    const sampleImages = useBrainStore((state) => state.sampleImages)
    const navigate = useNavigate()
    const [status, setStatus] = useState<Status>("loading")
    const [errorMsg, setErrorMsg] = useState("")

    useEffect(() => {
        let cancelled = false
        setStatus("loading")
        fetchBrainImg()
            .then((res: BrainRes) => {
                if (cancelled) return
                setSampleImages(res.sample_images)
                setStatus("ready")
            })
            .catch((err) => {
                if (cancelled) return
                setErrorMsg(err?.message || "Request failed")
                setStatus("error")
            })
        return () => {
            cancelled = true
        }
    }, [setSampleImages]);

    const brains = useMemo(() => {
        return sampleImages.map((brain) => brain.id)
    }, [sampleImages])

    function openFilePreview(brainId: string) {
        navigate(`/preview?brainId=${brainId}`)
    }

    return (
        <div
            className="flex flex-col p-4 bg-contain bg-center bg-repeat bg-slate-900 min-h-screen items-center text-center"
            style={{backgroundImage: `url(${backUrl})`}}>
            {/* <h2 className="text-4xl font-bold mb-12 mt-40 text-gray-900">Results Overview</h2> */}
            <h2 className="text-3xl font-bold mb-12 mt-40 text-transparent"></h2>
            <div className="flex space-x-12">
                <div
                    className="shadow-lg p-8 rounded-2xl transition-all duration-300 hover:shadow-xl w-[320px] bg-black/80 backdrop-blur-md bg-opacity-25">
                    <div className="font-semibold text-5xl text-gray-300 mb-6">Brain</div>

                    {status === "loading" && (
                        <LoadingProgress active inline label="Loading brain list" estKey="brains" />
                    )}

                    {status === "error" && (
                        <div className="py-6 text-sm text-rose-300">
                            <div className="font-medium">Couldn’t reach the server.</div>
                            <div className="mt-1 text-rose-300/70">{errorMsg}</div>
                            <div className="mt-2 text-cyan-300/80">
                                Use <span className="font-semibold">Connect to server</span> (top bar) and
                                check your backend / SSH tunnel.
                            </div>
                        </div>
                    )}

                    {status === "ready" && brains.length === 0 && (
                        <div className="py-6 text-sm text-gray-300/80">
                            No brains found on the server.
                        </div>
                    )}

                    {status === "ready" && brains.length > 0 && (
                        <ul className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                            {brains.map((brain) => (
                                <li
                                    key={brain}
                                    className="cursor-pointer hover:bg-indigo-200 text-3xl text-gray-300
                                             transition-all duration-200 py-2 px-4 rounded-lg
                                             hover:text-indigo-900"
                                    onClick={() => openFilePreview(brain)}
                                >
                                    {brain}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    )
}

export default memo(ResultDisplay)
