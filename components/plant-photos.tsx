"use client";
import { useState } from "react";
import { Leaf } from "lucide-react";
import {
  catalogReferences,
  type SurveyPlant,
  type ReferencePhoto,
} from "@/lib/survey";
import { storedReferencePhotos } from "@/lib/plant-reference-store";
export function RegionPhoto({
  photo,
  plant,
  sample = false,
}: {
  photo: string;
  plant: SurveyPlant;
  sample?: boolean;
}) {
  const [crop, setCrop] = useState<string | null>(null),
    [failed, setFailed] = useState(false);
  return (
    <div className="rw-crop">
      {!failed && (
        <img
          className="rw-crop-source"
          src={photo}
          alt=""
          aria-hidden="true"
          crossOrigin="anonymous"
          onError={() => setFailed(true)}
          onLoad={(e) => {
            try {
              const image = e.currentTarget,
                canvas = document.createElement("canvas");
              const b = plant.box;
              const sourceWidth = (image.naturalWidth * b.w) / 100,
                sourceHeight = (image.naturalHeight * b.h) / 100,
                scale = Math.min(600 / sourceWidth, 600 / sourceHeight, 1);
              canvas.width = Math.max(1, Math.round(sourceWidth * scale));
              canvas.height = Math.max(1, Math.round(sourceHeight * scale));
              const context = canvas.getContext("2d");
              if (!context) throw new Error();
              context.drawImage(
                image,
                (image.naturalWidth * b.x) / 100,
                (image.naturalHeight * b.y) / 100,
                (image.naturalWidth * b.w) / 100,
                (image.naturalHeight * b.h) / 100,
                0,
                0,
                canvas.width,
                canvas.height,
              );
              setCrop(canvas.toDataURL("image/jpeg", 0.9));
            } catch {
              setFailed(true);
            }
          }}
        />
      )}
      {crop ? (
        <img src={crop} alt={sample ? "Sample yard selected plant region" : "Your photographed plant region"} />
      ) : failed ? (
        <img src={photo} alt={sample ? "Sample yard full garden context" : "Your garden photo context"} />
      ) : (
        <span>Preparing your plant crop…</span>
      )}
      <span className="rw-crop-status">{sample ? "Sample yard photo" : "Your photo"} · {failed ? "full garden context" : "selected plant region"}</span>
    </div>
  );
}
export function usableReferencePhoto(scientificName: string, photos: ReferencePhoto[] = []) {
  return storedReferencePhotos(scientificName)[0] ||
    [...photos, ...catalogReferences(scientificName)].find((photo) =>
      photo.url.startsWith("https://") && !!photo.author &&
      !!photo.licenseUrl?.startsWith("https://") &&
      /^(cc[- ]by(?:[- ]sa)?|cc0|public domain|pd\b)/i.test(photo.license) &&
      !/\b(NC|ND)\b/i.test(photo.license));
}
export function ProfileImages({ photo, plant, sample, name, scientificName, photos = [] }: {
  photo: string; plant: SurveyPlant; sample: boolean; name: string;
  scientificName: string; photos?: ReferencePhoto[];
}) {
  const [showObservation, setShowObservation] = useState(false);
  const [referenceFailed, setReferenceFailed] = useState(false);
  const reference = usableReferencePhoto(scientificName, photos);
  const hasReference = !!reference && !referenceFailed;
  const observationLabel = sample ? "Sample yard photo" : "Your plant photo";
  return <div className="rw-profile-media">
    <div className="rw-profile-primary">
      {hasReference && !showObservation ?
        <ReferenceImage name={name} scientificName={scientificName} photos={photos} onUnavailable={() => setReferenceFailed(true)} /> :
        <figure className="rw-profile-observation-primary"><figcaption className="rw-photo-label">{observationLabel} · selected region</figcaption>
          <RegionPhoto photo={photo} plant={plant} sample={sample} />
          <a href={photo} target="_blank" rel="noreferrer">Open full {sample ? "sample yard" : "yard"} photo</a>
        </figure>}
    </div>
    {hasReference ? <>
      <button className="text-button rw-image-switch" onClick={() => setShowObservation(!showObservation)}>{showObservation ? "View reference photo" : sample ? "View sample plant photo" : "View your plant photo"}</button>
      {!showObservation && <div className="rw-profile-context">
        <RegionPhoto photo={photo} plant={plant} sample={sample} />
        <div><strong>{observationLabel}</strong><p>Smaller detected region for context.</p></div>
      </div>}
    </> : <p className="rw-reference-missing">{referenceFailed ? "The reference photo could not load." : "No verified reference photo is available."} Showing the selected observation instead.</p>}
  </div>;
}
export function ReferenceImage({
  name,
  scientificName,
  photos = [],
  variant = "detail",
  onUnavailable,
}: {
  name: string;
  scientificName: string;
  photos?: ReferencePhoto[];
  variant?: "detail" | "card";
  onUnavailable?: () => void;
}) {
  const stored = storedReferencePhotos(scientificName)[0];
  const provider = usableReferencePhoto(scientificName, photos);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url =
    variant === "card" && stored
      ? stored.thumbnailUrl || stored.url
      : provider?.url;
  const fullImage = stored?.url || provider?.url;
  const attribution = provider?.attributionUrl || provider?.url;
  return (
    <figure className={`rw-reference rw-reference-${variant}`}>
      <figcaption className="rw-photo-label">Reference photo</figcaption>
      {url && failedUrl !== url ? (
        <a
          href={fullImage}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open full reference image of ${name}`}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            aspectRatio: "4 / 3",
            background: "#edf2f2",
            overflow: "hidden",
          }}
        >
          <img
            src={url}
            srcSet={
              stored?.thumbnailUrl
                ? `${stored.thumbnailUrl} ${stored.thumbnailWidth}w, ${stored.url} ${stored.width}w`
                : undefined
            }
            sizes={
              variant === "card"
                ? "(max-width: 600px) 80vw, 300px"
                : "(max-width: 700px) 90vw, 440px"
            }
            alt={`Reference specimen: ${name}`}
            loading="lazy"
            referrerPolicy="no-referrer"
            width={stored?.width}
            height={stored?.height}
            style={{
              width: stored ? "100%" : "auto",
              height: stored ? "100%" : "auto",
              maxWidth: stored
                ? variant === "card"
                  ? stored.thumbnailWidth
                  : stored.width
                : "100%",
              maxHeight: stored
                ? variant === "card"
                  ? stored.thumbnailHeight
                  : stored.height
                : "100%",
              objectFit: variant === "detail" ? "contain" : "cover",
              objectPosition: "center",
            }}
            onError={() => { setFailedUrl(url); onUnavailable?.(); }}
          />
        </a>
      ) : (
        <div className="rw-no-photo">
          <Leaf size={25} />
          <span>No verified reference photo available</span>
        </div>
      )}
      <figcaption>
        {provider && failedUrl !== url ? (
          <>
            <a href={attribution} target="_blank" rel="noreferrer">
              {`Photo: ${provider.author} · ${sourceLabel(provider.source)}`}
            </a>
            {" · "}
            <a
              href={
                provider.licenseUrl
              }
              target="_blank"
              rel="noreferrer"
            >
              {provider.license}
            </a>
            {stored && (
              <small style={{ display: "block" }}>
                {variant === "card"
                  ? "Thumbnail resized to fit 480 pixels; WebP conversion."
                  : stored.modified}
              </small>
            )}
            <details className="rw-attribution-details">
              <summary>Attribution details</summary>
              <ReferenceCredits scientificName={scientificName} photos={photos} />
            </details>
            {fullImage && (
              <a
                href={fullImage}
                target="_blank"
                rel="noreferrer"
                style={{ display: "block" }}
              >
                Open full image ↗
              </a>
            )}
          </>
        ) : (
          "A source-attributed photo for this exact plant has not been added yet."
        )}
        {stored && failedUrl !== url && (
          <a
            href={stored.originalUrl}
            target="_blank"
            rel="noreferrer"
            style={{ display: "block" }}
          >
            Original source image ↗
          </a>
        )}
      </figcaption>
    </figure>
  );
}

function sourceLabel(source: string) {
  return source === "PlantNet" ? "Pl@ntNet" : source === "Wikimedia Commons" ? "Wikimedia Commons" : "Source not specified";
}
/** Public image provenance only: private survey photo URLs are never attribution. */
export function ReferenceCredits({ scientificName, photos = [] }: { scientificName: string; photos?: ReferencePhoto[] }) {
  const stored = storedReferencePhotos(scientificName)[0];
  const photo = stored || [...photos, ...catalogReferences(scientificName)].find(p => p.url.startsWith("https://") && p.author && p.licenseUrl?.startsWith("https://") && /^(cc[- ]by(?:[- ]sa)?|cc0|public domain|pd\b)/i.test(p.license) && !/\b(NC|ND)\b/i.test(p.license));
  if (!photo) return <p>No source-attributed reference photograph is available for this exact taxon.</p>;
  return <div className="rw-reference-credits">
    <p>Photo: {photo.author} · {sourceLabel(photo.source)}</p>
    {photo.citation && <p>Recorded credit: {photo.citation}</p>}
    <p><a href={photo.attributionUrl || photo.url} target="_blank" rel="noreferrer">Source description page</a>{" · "}<a href={photo.licenseUrl} target="_blank" rel="noreferrer">{photo.license}</a></p>
    {stored && <><p>{("fileTitle" in stored ? String(stored.fileTitle) : scientificName)} · Reference taxon: {stored.sourceTaxon}</p><p>{stored.modified}</p><a href={stored.originalUrl} target="_blank" rel="noreferrer">Original source image ↗</a></>}
  </div>;
}
