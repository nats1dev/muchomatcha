import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export async function saveUpload(
  file: File | null,
  oldPath?: string | null,
): Promise<string | null> {
  if (!file || file.size === 0) return oldPath ?? null;
  if (file.size > MAX_SIZE) throw new Error("La imagen no debe superar 5 MB");

  await mkdir(UPLOAD_DIR, { recursive: true });

  const ext = path.extname(file.name).toLowerCase() || ".jpg";
  const filename = `${crypto.randomUUID()}${ext}`;
  const filepath = path.join(UPLOAD_DIR, filename);

  const bytes = await file.arrayBuffer();
  await writeFile(filepath, Buffer.from(bytes));

  if (oldPath) {
    const oldFilepath = path.join(process.cwd(), "public", oldPath);
    await unlink(oldFilepath).catch(() => {});
  }

  return `/uploads/${filename}`;
}
