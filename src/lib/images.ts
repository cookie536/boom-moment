export async function thumbnailUrl(blob: Blob, maxEdge = 640) {
  try {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return URL.createObjectURL(blob);
    }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const thumb = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), "image/jpeg", 0.82);
    });
    return URL.createObjectURL(thumb ?? blob);
  } catch {
    return URL.createObjectURL(blob);
  }
}
