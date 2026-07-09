import React from "react";
import paperData from "@/configs/paper.json";
import YouTube from "react-youtube";

const WIDTH = 860;
const HEIGHT = (WIDTH * 9) / 16;

const CONTAINER_STYLES = `
    bg-slate-800/80 
    backdrop-blur-xl 
    rounded-xl 
    border 
    border-cyan-500/20 
    shadow-lg 
    relative 
    overflow-hidden 
    group
    transition-all 
    duration-300
    hover:shadow-cyan-500/10 
    hover:border-cyan-500/30
`;

const Main: React.FC = () => {
    return (
        <div className={`min-h-screen bg-slate-900 text-white`}>
            <main className="pt-24">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <h1 className="text-4xl font-bold mb-6 bg-gradient-to-r from-cyan-500 to-blue-500 inline-block text-transparent bg-clip-text">
                        {paperData.title}
                    </h1>

                    <p className="text-lg mb-12 text-gray-400">{paperData.abstract}</p>

                    <div className="space-y-8">
                        {/* <section>
                            <h2 className="text-2xl font-semibold mb-4 text-cyan-400">YouTube Video</h2>
                            <div
                                className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-cyan-500/20 shadow-lg">
                                <YouTube videoId={'XxVg_s8xAms'} opts={{
                                    width: '100%',
                                    height: HEIGHT
                                }}/>
                            </div>
                        </section> */}

                        <section>
                            <div className="relative z-10">
                                <div className="flex items-center mb-6">
                                    <div
                                        className="flex items-center justify-center w-12 h-12 rounded-lg bg-cyan-500/10 mr-4">
                                        <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor"
                                             viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                        </svg>
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-semibold text-cyan-400">Read-Only Demo</h2>
                                        <p className="text-gray-400 text-sm mt-1">
                                            This frontend now focuses on browsing the published sample results only.
                                        </p>
                                    </div>
                                </div>

                                {/* <div className={CONTAINER_STYLES}>
                                    <div className="absolute inset-0">
                                        <div
                                            className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-blue-500/5"/>
                                        <div className="absolute inset-0 bg-grid-white/[0.02] bg-grid-repeat-[24px]"/>
                                    </div>

                                    <div className="relative p-8">
                                        <div className="max-w-3xl space-y-4 text-gray-300">
                                            <p>
                                                Sample brains listed above can be opened directly in the preview viewer.
                                                The application no longer includes account, permission, or file upload workflows.
                                            </p>
                                            <p>
                                                That keeps the deployed surface limited to published paper metadata,
                                                the embedded video walkthrough, and sample-volume exploration.
                                            </p>
                                        </div>
                                    </div>
                                </div> */}
                            </div>
                        </section>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default Main;
