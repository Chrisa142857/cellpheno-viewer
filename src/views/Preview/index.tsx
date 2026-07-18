import { useSearchParams } from "react-router-dom";
import ModulateScalar from "@/components/ThreeNii";
import React, { useMemo } from "react";
import useBrainStore from "@/stores/brain.ts";

const Preview: React.FC = () => {
  const sampleImages = useBrainStore((state) => state.sampleImages);
  const [searchParams] = useSearchParams();
  const brainId = searchParams.get("brainId");

  const brain = useMemo(
    () => (brainId ? sampleImages.find(({ id }) => id === brainId) : undefined),
    [brainId, sampleImages]
  );

  const volumes = useMemo(() => {
    if (!brain) return null;
    return brain.images.reduce<Record<string, string>>((acc, item) => {
      acc[item.name] = item.url;
      return acc;
    }, {});
  }, [brain]);

  return (
    <div>
      {brainId && volumes ? (
        <ModulateScalar volumes={volumes} brainId={brainId} description={brain?.description} />
      ) : (
        <p>Not Found!</p>
      )}
    </div>
  );
};

export default Preview;
