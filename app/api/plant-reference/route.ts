export async function GET(request: Request) {
  const name = new URL(request.url).searchParams.get("name")?.trim() || "";
  if (name.length > 100 || !/^\p{L}[\p{L}\s×.\-]+$/u.test(name))
    return Response.json({ photos: [] }, { status: 400 });
  if (process.env.PLANTNET_API_KEY) {
    try {
      const query = new URLSearchParams({
        "api-key": process.env.PLANTNET_API_KEY,
        prefix: name,
        images: "true",
        page: "1",
        pageSize: "3",
        lang: "en",
      });
      const response = await fetch(
        `https://my-api.plantnet.org/v2/species?${query}`,
        { signal: AbortSignal.timeout(4000), next: { revalidate: 86400 } },
      );
      if (response.ok) {
        const data = await response.json();
        const species = (Array.isArray(data) ? data : data.results || []).find(
          (p: { scientificNameWithoutAuthor?: string }) =>
            p.scientificNameWithoutAuthor?.toLowerCase() === name.toLowerCase(),
        );
        const photos = (species?.images || [])
          .slice(0, 3)
          .map(
            (p: {
              url?: { m?: string; o?: string };
              author?: string;
              license?: string;
              citation?: string;
            }) => ({
              url: p.url?.m || p.url?.o,
              author: p.author,
              license: p.license,
              citation: p.citation,
              source: "PlantNet",
            }),
          )
          .filter(
            (p: { url?: string; author?: string; license?: string }) =>
              p.url?.startsWith("https://") && p.author && p.license,
          );
        if (photos.length) return Response.json({ photos });
      }
    } catch {
      /* Use openly licensed reference imagery when taxonomy images are unavailable. */
    }
  }
  try {
    const query = new URLSearchParams({
      action: "query",
      format: "json",
      generator: "search",
      gsrsearch: `intitle:"${name}" filetype:bitmap -intitle:map`,
      gsrnamespace: "6",
      gsrlimit: "3",
      prop: "imageinfo",
      iiprop: "url|extmetadata",
      iiurlwidth: "600",
    });
    const response = await fetch(
      `https://commons.wikimedia.org/w/api.php?${query}`,
      {
        headers: {
          "User-Agent": "NativeYardLocal/0.1 (plant reference viewer)",
        },
        signal: AbortSignal.timeout(6000),
        next: { revalidate: 86400 },
      },
    );
    if (!response.ok) return Response.json({ photos: [] });
    const data = await response.json();
    const pages = Object.values(data.query?.pages || {}) as Array<{
      title?: string;
      imageinfo?: Array<{
        thumburl?: string;
        url?: string;
        descriptionurl?: string;
        extmetadata?: Record<string, { value?: string }>;
      }>;
    }>;
    const photos = pages
      .flatMap((page) => {
        const info = page.imageinfo?.[0],
          meta = info?.extmetadata;
        if (
          !page.title?.toLowerCase().includes(name.toLowerCase()) ||
          !info ||
          !meta
        )
          return [];
        const author = (meta.Artist?.value || "")
            .replace(/<[^>]*>/g, "")
            .trim(),
          license = meta.LicenseShortName?.value,
          url = info.thumburl || info.url;
        if (
          !author ||
          !license ||
          !url?.startsWith("https://upload.wikimedia.org/")
        )
          return [];
        return [
          {
            url,
            author,
            license,
            licenseUrl: meta.LicenseUrl?.value,
            attributionUrl: info.descriptionurl,
            citation: `${author} / Wikimedia Commons`,
            source: "Wikimedia Commons",
          },
        ];
      })
      .slice(0, 2);
    return Response.json({ photos });
  } catch {
    return Response.json({ photos: [] });
  }
}
