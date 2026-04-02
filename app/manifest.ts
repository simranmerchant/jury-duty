import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "jury duty",
    short_name: "jury duty",
    description: "you've been summoned.",
    start_url: "/events",
    display: "standalone",
    background_color: "#0d0d0f",
    theme_color: "#ff5e80",
    orientation: "portrait",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
