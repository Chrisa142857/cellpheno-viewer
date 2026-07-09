export interface BrainRes  {
    code: number
    message: string
    sample_images: BrainItem[]
}

export interface BrainItem {
    id: string
    images: BrainImage[]
}

export interface BrainImage {
    name: string
    url: string
}
