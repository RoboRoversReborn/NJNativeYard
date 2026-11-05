import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NativeYard",
    short_name: "NativeYard",
    description:
      "Audit your yard's plants and build a keystone-native habitat plan.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f4e9",
    theme_color: "#163f2c",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
