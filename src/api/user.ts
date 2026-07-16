import type {BrainImage, BrainItem, BrainRes} from "@/types/user";
import {DEMO_ORIGIN, MINIO_BUCKET_NAME, MINIO_ORIGIN, ZOOM_API_ORIGIN} from "@/configs/minio";

const VOLUME_FILE_PATTERN = /\.(nii(\.gz)?|nrrd)$/i;

const parseObjectNamesFromXml = (xmlText: string): {
    isTruncated: boolean;
    nextContinuationToken?: string;
    objectNames: string[];
} => {
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, "application/xml");

    const errorNode = xml.querySelector("Error");
    if (errorNode) {
        const message = errorNode.querySelector("Message")?.textContent ?? "Failed to list MinIO objects";
        throw new Error(message);
    }

    return {
        isTruncated: xml.querySelector("IsTruncated")?.textContent === "true",
        nextContinuationToken: xml.querySelector("NextContinuationToken")?.textContent ?? undefined,
        objectNames: Array.from(xml.querySelectorAll("Contents > Key"))
            .map((node) => node.textContent?.trim())
            .filter((key): key is string => Boolean(key)),
    };
};

const listMinioObjectNames = async (): Promise<string[]> => {
    const objectNames: string[] = [];
    let continuationToken: string | undefined;

    do {
        const listUrl = new URL(`${MINIO_ORIGIN}/${MINIO_BUCKET_NAME}`);
        listUrl.searchParams.set("list-type", "2");
        if (continuationToken) {
            listUrl.searchParams.set("continuation-token", continuationToken);
        }

        const response = await fetch(listUrl.toString());
        if (!response.ok) {
            throw new Error(`Failed to list MinIO objects: ${response.status}`);
        }

        const xmlText = await response.text();
        const parsed = parseObjectNamesFromXml(xmlText);
        objectNames.push(...parsed.objectNames);
        continuationToken = parsed.isTruncated ? parsed.nextContinuationToken : undefined;
    } while (continuationToken);

    return objectNames;
};

const removeKnownExtensions = (fileName: string): string => {
    if (fileName.toLowerCase().endsWith(".nii.gz")) {
        return fileName.slice(0, -7);
    }

    const lastDotIndex = fileName.lastIndexOf(".");
    return lastDotIndex >= 0 ? fileName.slice(0, lastDotIndex) : fileName;
};

const toBrainImage = (brainId: string, objectName: string): BrainImage | null => {
    if (objectName.endsWith("/") || !VOLUME_FILE_PATTERN.test(objectName)) {
        return null;
    }

    const fileName = objectName.split("/").pop();
    if (!fileName) {
        return null;
    }

    const rawName = removeKnownExtensions(fileName);
    const normalizedPrefix = `${brainId}_`.toLowerCase();
    const normalizedName = rawName.toLowerCase().startsWith(normalizedPrefix)
        ? rawName.slice(brainId.length + 1)
        : rawName;

    return {
        name: normalizedName,
        url: `${MINIO_ORIGIN}/${MINIO_BUCKET_NAME}/${objectName}`,
    };
};

const toBrainId = (objectName: string): string | null => {
    const segments = objectName.split("/").filter(Boolean);
    if (segments.length === 0) {
        return null;
    }

    if (segments.length > 1) {
        return segments[0];
    }

    const fileName = segments[0];
    if (!VOLUME_FILE_PATTERN.test(fileName)) {
        return null;
    }

    return removeKnownExtensions(fileName).split("_")[0] || null;
};

const buildBrainRes = (objectNames: string[]): BrainRes => {
    const brainMap = new Map<string, BrainImage[]>();

    objectNames.forEach((objectName) => {
        const brainId = toBrainId(objectName);
        if (!brainId) {
            return;
        }

        const brainImage = toBrainImage(brainId, objectName);
        if (!brainImage) {
            return;
        }

        const existingImages = brainMap.get(brainId) ?? [];
        existingImages.push(brainImage);
        brainMap.set(brainId, existingImages);
    });

    const sampleImages: BrainItem[] = Array.from(brainMap.entries())
        .map(([id, images]) => ({
            id,
            images: images.sort((left, right) => left.name.localeCompare(right.name)),
        }))
        .sort((left, right) => left.id.localeCompare(right.id));

    return {
        code: 2001,
        message: "success",
        sample_images: sampleImages,
    };
};

// When the on-demand zoom service is configured, get the brain list + density
// maps from it (GET /brains) instead of MinIO, so the whole backend is a single
// origin. Each density-map URL is relative; we prepend the zoom service origin.
const fetchBrainImgFromZoomApi = async (): Promise<BrainRes> => {
    const response = await fetch(`${ZOOM_API_ORIGIN}/brains`);
    if (!response.ok) {
        throw new Error(`Failed to list brains: ${response.status}`);
    }
    const data = (await response.json()) as { brains?: { id: string; densitymapUrl: string }[] };
    const sample_images: BrainItem[] = (data.brains ?? []).map((b) => {
        const image: BrainImage = {
            name: "density",
            url: `${ZOOM_API_ORIGIN}${b.densitymapUrl}`,
        };
        return { id: b.id, images: [image] };
    });
    return { code: 2001, message: "success", sample_images };
};

// Static demo: brains pre-materialized on a public bucket (no live server).
const fetchBrainImgFromDemo = async (): Promise<BrainRes> => {
    const response = await fetch(`${DEMO_ORIGIN}/demo/manifest.json`);
    if (!response.ok) throw new Error(`Failed to list demo brains: ${response.status}`);
    const data = (await response.json()) as { brains?: string[] };
    const sample_images: BrainItem[] = (data.brains ?? []).map((id) => ({
        id,
        images: [{ name: "density", url: `${DEMO_ORIGIN}/demo/${id}/density.nii.gz` } as BrainImage],
    }));
    return { code: 2001, message: "success", sample_images };
};

export const fetchBrainImg = async (): Promise<BrainRes> => {
    if (ZOOM_API_ORIGIN) {
        return fetchBrainImgFromZoomApi();
    }
    if (DEMO_ORIGIN) {
        return fetchBrainImgFromDemo();
    }
    const objectNames = await listMinioObjectNames();
    return buildBrainRes(objectNames);
};
