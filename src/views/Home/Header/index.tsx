import React from "react";
import {FileText, Github, Link} from 'lucide-react';
import ConnectServer from "@/components/ConnectServer";
// logo.png (22KB), not the same-looking black_logo4.svg (2.7MB — a 3000px
// bitmap in an SVG wrapper); this renders at 48px.
import logoUrl from "@/assets/images/logo.png";
const Header: React.FC = () => {

    return (
        <div
            className="fixed top-0 left-0 right-0 w-full bg-slate-900 border-b border-cyan-500/20 backdrop-blur-sm z-50">
            {/* <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center"> */}
            <div className=" mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
                {/* Left Container */}
                <div className="flex items-center space-x-4">
                    <div
                        className="w-12 h-12 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center">
                        {/* <span className="text-white font-bold text-xl"></span> */}
                        <img src={logoUrl} alt="Advanced Computational Medicine Laboratory logo" />
                    </div>
                    <h2 className="text-white font-comic">
                        <span className="block text-sm text-cyan-400">The Advanced Computational</span>
                        <span className="block text-lg font-semibold">Medicine Laboratory</span>
                    </h2>
                </div>

                {/* Right Container */}
                <div className="flex items-center space-x-6">
                    <ConnectServer />

                    <a href="http://localhost:8080/confcats-event-sessions/isbi23/papers/paper_293.pdf"
                       className="text-cyan-400 hover:text-cyan-300 transition-colors">
                        <FileText className="h-6 w-6"/>
                    </a>

                    <a href="https://link.springer.com/chapter/10.1007/978-3-031-43901-8_5"
                       className="text-cyan-400 hover:text-cyan-300 transition-colors">
                        <Link className="w-6 h-6"/>
                    </a>

                    <a href="https://github.com/Chrisa142857/Lightsheet_microscopy_image_3D_nuclei_instance_segmentation"
                       className="text-cyan-400 hover:text-cyan-300 transition-colors">
                        <Github className="w-6 h-6"/>
                    </a>
                </div>
            </div>
        </div>
    );
};

export default Header;
