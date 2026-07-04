/** Mobile crop path for a desktop hero slide image. */
export function heroMobileImage(image?: string): string | undefined {
  if (!image) return undefined;
  const base = image.split("/").pop();
  if (!base) return image;
  return `/slides/mobile/${base}`;
}

export function preloadHeroImages(urls: string[]): void {
  if (typeof window === "undefined") return;
  for (const url of urls) {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
  }
}
