import { writeFile, mkdir, unlink } from "fs/promises";

// Railway puede montar un volumen en esta ruta. En local conservamos el
// comportamiento anterior dentro de public/uploads.
const UPLOAD_DIR = process.env.UPLOAD_DIR || "public/uploads";
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export async function saveUpload(
  file: File | null,
  oldPath?: string | null,
): Promise<string | null> {
  if (!file || file.size === 0) return oldPath ?? null;
  if (file.size > MAX_SIZE) throw new Error("La imagen no debe superar 5 MB");

  await mkdir(UPLOAD_DIR, { recursive: true });

  const dot = file.name.lastIndexOf(".");
  const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : ".jpg";
  const filename = `${crypto.randomUUID()}${ext}`;
  const filepath = `${UPLOAD_DIR}/${filename}`;

  const bytes = await file.arrayBuffer();
  await writeFile(filepath, Buffer.from(bytes));

  if (oldPath) {
    const oldFilename = oldPath.replace(/^\/uploads\//, "");
    const oldFilepath = `${UPLOAD_DIR}/${oldFilename}`;
    await unlink(oldFilepath).catch(() => {});
  }

  return `/uploads/${filename}`;
}
