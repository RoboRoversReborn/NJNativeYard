import { PlantDisclaimer } from "./plant-disclaimer";
import { plantDisplayNote } from "@/lib/plant-display-note";
import { getNurseries, regionForZip } from "@/lib/plants";
import {
  category,
  plantById,
  resolvedPlant,
  summary,
  type Survey,
} from "@/lib/survey";
import { sampleYardById } from "@/lib/sample-yards";
import { SampleCredit } from "./sample-gallery";
import { nativePlantingOption } from "@/lib/nj-evidence";
import { plantProfileSummary, PlantHorticultureSource } from "./plant-profile";
import { PlantNextActions } from "./plant-next-actions";
import { PlantCautions, PlantCompleteReference, PlantStory, PlantRecognitionCues } from "./plant-profile";
import { ReferenceCredits } from "./plant-photos";
import { plantGuidance } from "@/lib/plant-guidance";
export function SurveyPrintReport({ survey }: { survey: Survey }) {
  const stats = summary(survey),
    region = regionForZip(survey.zip),
    nurseries = getNurseries(region.county).slice(0, 3);
  return (
    <section className="print-report">
      <h2>Ecological transformation report</h2>
      {survey.source === "sample" && sampleYardById(survey.sampleId) && (
        <div>
          <p>
            {sampleYardById(survey.sampleId)!.title} · Illustrative sample yard.
          </p>
          <SampleCredit sample={sampleYardById(survey.sampleId)!} />
        </div>
      )}
      <p>
        {survey.zip} · {region.county} · {region.province} ·{" "}
        {new Date(survey.createdAt).toLocaleDateString()}
      </p>
      <p>
        {survey.source === "sample"
          ? "Illustrative sample."
          : "Uploaded photo survey."}{" "}
        {stats.reviewed} of {stats.total} included {stats.assessmentScope === "yard" ? "yard " : "photo "}regions reviewed.{" "}
        {stats.nativeShare === null
          ? "No ecosystem estimate until a plant can be assessed."
          : `${stats.nativeShare}% native among assessed regions. Ecosystem estimate: ${stats.score}/100 (${stats.provisional ? "provisional" : "identities reviewed"}). Coverage: ${stats.coverage}%.`}
      </p>
      {survey.source === "upload" && (
        <p>
          {stats.assessmentScope === "photo"
            ? "Photo estimate; yard boundary is unconfirmed."
            : "Yard estimate from confirmed yard regions."}{" "}
          {stats.scope.yard} yard · {stats.scope.background} background ·{" "}
          {stats.scope.unconfirmed} unconfirmed regions. Background regions are
          excluded from the estimate.
        </p>
      )}
      {survey.plants.map((d, i) => {
        const p = resolvedPlant(d);
        const guidance = p ? plantGuidance(p) : null;
        const refs = d.candidates.find(c => c.plantId === p?.id || c.scientificName === d.scientificName)?.referencePhotos;
        return (
          <article key={d.id}>
            <h3>
              {i + 1}. {p?.commonName || d.suggestion} —{" "}
              {d.reviewed ? "Reviewed identity" : "Unverified suggestion"}
            </h3>
            <p>
              <em>{p?.scientificName || d.scientificName}</em>
            </p>
            {survey.source === "upload" && (
              <p>
                {d.yardScope === "background"
                  ? "Background context · excluded from the yard estimate and replacement planning."
                  : d.yardScope === "yard"
                    ? "Confirmed yard region."
                    : "Yard membership unconfirmed."}
              </p>
            )}
            {plantDisplayNote(d.note) && <p>{plantDisplayNote(d.note)}</p>}
            <h4>Candidate identities</h4>
            <ul>{d.candidates.map((c, n) => <li key={n}>{c.commonName} · {c.scientificName}</li>)}</ul>
            {p && (
              <>
                <p>
                  {d.reviewed ? "Category" : "If this match is correct"}:{" "}
                  {category(p).label}. {plantProfileSummary(p)}
                </p>
                <h4>About this plant</h4>
                <PlantStory plant={p} narrativeOnly />
                <PlantRecognitionCues plant={p} />
                <PlantCompleteReference plant={p} />
                {guidance && <><h4>Ecology & local category</h4><p>{guidance.why}</p><h4>General care principles</h4>{guidance.actions.map(a => <section key={a.title}><h5>{a.title}</h5><p>{a.season} · {a.detail}</p></section>)}{guidance.sources.map(source => <p key={source.url}><a href={source.url}>{source.label}</a></p>)}</>}
                <PlantHorticultureSource plant={p} />
                {p.landscapeContext && (
                  <p>
                    <strong>Site context: </strong>
                    {p.landscapeContext.note}
                  </p>
                )}
                <PlantCautions plant={p} />
                <PlantNextActions plant={p} reviewed={d.reviewed} />
                <p>
                  Light: {p.sun} · Moisture: {p.moisture} · Bloom: {p.bloom} ·
                  Size: {p.height}
                </p>
                {p.njEvidence && (
                  <p>
                    NJ evidence: {p.njEvidence.note}{" "}
                    {p.njEvidence.sources.map((source) => (
                      <a key={source.url} href={source.url}>
                        {source.label}{" "}
                      </a>
                    ))}
                  </p>
                )}
                {p.swapIds?.length &&
                (survey.source === "sample" || d.yardScope === "yard") ? (
                  <p>
                    Native alternatives:{" "}
                    {p.swapIds
                      .map(plantById)
                      .filter((p) => !!p && nativePlantingOption(p))
                      .map((p) => p!.commonName)
                      .join(", ")}
                    . Check growing conditions and mature size.
                  </p>
                ) : null}
                {p.removal && d.reviewed && (
                  <p>
                    Earlier control notes below were not revalidated by the
                    horticultural reference update. Check current NJ
                    species-specific guidance.
                  </p>
                )}
                {p.removal &&
                  d.reviewed &&
                  Object.entries(p.removal).map(([k, v]) => (
                    <p key={k}>
                      <strong>{k}: </strong>
                      {v}
                    </p>
                  ))}
              </>
            )}
            <h4>Sources & photo credits</h4>
            <ReferenceCredits scientificName={p?.scientificName || d.scientificName} photos={refs} />
          </article>
        );
      })}
      <h3>Local nursery leads</h3>
      <p>
        Starting points for research, not verified inventory:{" "}
        {nurseries.map((n) => n.name).join(" · ")}.
      </p>
      <PlantDisclaimer />
    </section>
  );
}
