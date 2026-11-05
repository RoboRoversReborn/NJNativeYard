"use client";
import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
export function UploadProgress({
  phase,
  name,
  preview,
  onCancel,
}: {
  phase: "preparing" | "analysing";
  name: string;
  preview: string | null;
  onCancel: () => void;
}) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setSeconds((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="upload-progress" aria-busy="true">
      <div className="upload-progress-main">
        {preview && <img src={preview} alt="Photo being analysed" />}
        <div>
          <p className="upload-file-name">{name}</p>
          <h3 role="status">
            <LoaderCircle className="spin" size={19} />
            {phase === "preparing"
              ? "Preparing your photo…"
              : "Finding plants in your photo…"}
          </h3>
          <p>
            {phase === "preparing"
              ? "Optimising the image for upload."
              : "Locating separate plant regions and comparing possible matches."}
          </p>
          <small>
            {seconds}s elapsed · Larger mixed gardens can take up to a minute.
          </small>
          {seconds >= 20 && (
            <p className="upload-wait-note">
              Still working. A complete yard scan will not be replaced with a
              single-plant guess.
            </p>
          )}
        </div>
      </div>
      <button type="button" className="secondary" onClick={onCancel}>
        Cancel analysis
      </button>
    </div>
  );
}
