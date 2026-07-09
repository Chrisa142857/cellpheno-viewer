import {create} from "zustand";
import {devtools, persist} from "zustand/middleware";
import type {BrainItem} from "@/types/user";

interface BrainState {
    sampleImages: BrainItem[]
    setSampleImages: (sampleImages: BrainItem[]) => void
}

const useBrainStore = create<BrainState>()(
    devtools(
        persist(
            (set, get) => ({
                sampleImages: [],
                setSampleImages: (sampleImages) => set({sampleImages}),
            }),
            {name: "brainStore"}
        )
    )
)

export default useBrainStore