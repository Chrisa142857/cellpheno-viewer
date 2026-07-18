export interface BrainRes  {
    code: number
    message: string
    sample_images: BrainItem[]
}

export interface BrainItem {
    id: string
    images: BrainImage[]
    /** Optional human-readable subtitle (sex · age · markers), e.g. for the demo brain. */
    description?: string
}

export interface BrainImage {
    name: string
    url: string
}
