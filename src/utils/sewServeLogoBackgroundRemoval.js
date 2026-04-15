/**
 * Builds a PNG data URL from a loaded image, keying out pixels close in color to
 * the four corners (typical flat light background). Safe for dark marks that
 * sit away from corners.
 */
export function sewServeLogoImageToDataUrl(img) {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("Canvas 2D context unavailable");
  }
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  const w = canvas.width;
  const h = canvas.height;

  const corners = [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
  ].map(([x, y]) => {
    const idx = (y * w + x) * 4;
    return [data[idx], data[idx + 1], data[idx + 2]];
  });

  const threshold = 72;
  const feather = 22;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    let dist = Infinity;
    for (const [cr, cg, cb] of corners) {
      dist = Math.min(dist, Math.hypot(r - cr, g - cg, b - cb));
    }

    if (dist <= threshold) {
      data[i + 3] = 0;
    } else if (dist <= threshold + feather) {
      const ratio = (dist - threshold) / feather;
      data[i + 3] = Math.round(data[i + 3] * ratio);
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}
