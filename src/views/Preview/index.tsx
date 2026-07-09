import { useSearchParams } from "react-router-dom";
import ModulateScalar from "@/components/ThreeNii";
import React, { useMemo } from "react";
import useBrainStore from "@/stores/brain.ts";

const Preview: React.FC = () => {
  const sampleImages = useBrainStore((state) => state.sampleImages);
  const [searchParams] = useSearchParams();
  const brainId = searchParams.get("brainId");

  const volumes = useMemo(() => {
    if (!brainId) return null;
    const brain = sampleImages.find(({ id }) => id === brainId);
    if (!brain) return null;
    return brain.images.reduce<Record<string, string>>((acc, item) => {
      acc[item.name] = item.url;
      return acc;
    }, {});
  }, [brainId, sampleImages]);

  return (
    <div>
      {brainId && volumes ? (
        <ModulateScalar volumes={volumes} brainId={brainId} />
      ) : (
        <p>Not Found!</p>
      )}
    </div>
  );
};

export default Preview;
