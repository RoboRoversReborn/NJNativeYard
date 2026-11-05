import type { Plant } from "./types";
import { category } from "./survey";
import { profileStatus } from "./nj-evidence";
export type PlantAction = { title: string; season: string; detail: string };
export function plantGuidance(plant: Plant) {
  const status = profileStatus(plant);
  const native = status === "native" || status === "keystone";
  const why = plant.njEvidence?.sources.length
    ? `${category(plant).description} ${plant.njEvidence.note}`
    : plant.id === "cotinus-coggygria"
      ? "Smoketree originates in Eurasia, rather than New Jersey. It is an ornamental choice; a non-native label by itself does not mean a plant requires removal."
      : category(plant).description;
  const recognitionOnly =
    plant.landscapeContext?.recommendation === "recognition-only";
  const actions: PlantAction[] = recognitionOnly
    ? [
        {
          title: "Compare the plant’s features",
          season: "When visible",
          detail:
            "Compare a clear leaf, stem, flower or fruit photo with the source features. A reference profile does not confirm the match in your yard.",
        },
        {
          title: "Read its local role and cautions",
          season: "Before deciding what to do",
          detail:
            "Check the NJ evidence and source cautions. This profile supports recognition; it is not a recommendation to plant or a species-specific control plan.",
        },
        {
          title: "Keep an observation",
          season: "On your next visit",
          detail:
            "Record the features and plant stage you actually see. Use current NJ species guidance before making a management decision.",
        },
      ]
    : status === "invasive"
      ? [
          {
            title: "Confirm, then prioritise control",
            season: "Before you act",
            detail:
              "Check the identification against leaf, stem, and growth-habit features before removing a plant.",
          },
          {
            title: "Use a species-specific removal plan",
            season: "Check the species-specific NJ guide",
            detail:
              "Consult the linked NJ invasive-species guidance for the confirmed species. A status listing does not establish the right control method or timing for every site.",
          },
          {
            title: "Replant and monitor",
            season: "Spring or early autumn",
            detail:
              "Match a native replacement to the site and monitor the cleared area for regrowth.",
          },
        ]
      : status === "unverified"
        ? [
            {
              title: "Get to know the plant",
              season: "Any season",
              detail:
                "Compare the leaf, flower, fruit and growth features with your photo. A known botanical name does not always settle its NJ ecological category.",
            },
            {
              title: "Check the local evidence",
              season: "Before a planting decision",
              detail:
                "Review the NJ source notes and exact species or subspecies. A general US-native label does not establish NJ nativity.",
            },
            {
              title: "Observe through the seasons",
              season: "Across the growing season",
              detail:
                "Keep notes on its flowering and growth. Use the sourced growing guide where available; avoid removal or replacement based only on an unresolved category.",
            },
          ]
        : native
          ? [
              {
                title: "Keep this habitat resource",
                season: "All year",
                detail:
                  "Retain healthy established plants. Observe flowering, seeds, and wildlife use as the seasons change.",
              },
              {
                title: "Leave useful winter structure",
                season: "Autumn–winter",
                detail:
                  "Where suitable, keep seed heads, standing perennial stems, and some fallen leaves as food and shelter.",
              },
              {
                title: "Add complementary native layers",
                season: "Spring or early autumn",
                detail:
                  "Choose planting time for the species and local weather; avoid planting into frozen soil or extreme heat.",
              },
            ]
          : [
              {
                title: "Keep or replace intentionally",
                season: "Plan any time",
                detail:
                  "An established ornamental can remain while you add native plants nearby. A non-native category is not an automatic removal instruction.",
              },
              {
                title: "Plan a habitat-rich alternative",
                season: "Spring or early autumn",
                detail:
                  "Compare mature size, light, moisture, and garden role before choosing a native replacement.",
              },
              {
                title: "Observe before pruning",
                season: "Species-specific",
                detail:
                  "Check the flowering cycle and pruning response of this species before cutting.",
              },
            ];
  const sources = [
    ...(plant.njEvidence?.sources || []),
    ...(recognitionOnly
      ? []
      : [
          {
            label: "Regional planting guidance · Penn State Extension",
            url: "https://extension.psu.edu/is-fall-for-planting",
          },
          {
            label: "Native plant seasonal care · SDSU Extension",
            url: "https://extension.sdstate.edu/fall-native-plant-care",
          },
        ]),
  ];
  if (plant.id === "cotinus-coggygria") {
    actions[2] = {
      title: "Decide between flowers and rejuvenation",
      season: "Late winter, if rejuvenation is needed",
      detail:
        "Hard pruning can refresh foliage and shape but sacrifices flowering. Avoid routine hard cuts when the smoky flower display is your goal.",
    };
    sources.unshift({
      label: "Smoketree profile · NC State Extension",
      url: "https://plants.ces.ncsu.edu/plants/cotinus-coggygria/",
    });
  }
  return {
    why,
    role: native
      ? status === "keystone"
        ? "A high-value native layer for the local food web."
        : "A locally native component of a layered garden."
      : status === "unverified"
        ? "A plant whose New Jersey ecological role still needs corroboration."
        : status === "invasive"
          ? "A listed ecological concern to confirm before planning control."
          : "An introduced ornamental in this garden’s plant mix.",
    actions,
    sources: sources.filter(
      (source, index) =>
        sources.findIndex((other) => other.url === source.url) === index,
    ),
  };
}
