import sharp from "sharp";

const [inputPath, outputPath] = process.argv.slice(2);

if (!inputPath || !outputPath) {
  throw new Error("Usage: node scripts/remove-chroma.mjs <input> <output>");
}

const { data, info } = await sharp(inputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const key = [255, 0, 255];

for (let index = 0; index < data.length; index += info.channels) {
  const distance = Math.hypot(
    data[index] - key[0],
    data[index + 1] - key[1],
    data[index + 2] - key[2],
  );
  // Image generation slightly varies the flat key colour near the image edge.
  // Keep the wide low-distance band fully transparent, then feather into the art.
  const alpha = Math.max(0, Math.min(255, Math.round(((distance - 68) / 82) * 255)));
  data[index + 3] = Math.min(data[index + 3], alpha);
}

await sharp(data, { raw: info }).png().toFile(outputPath);
