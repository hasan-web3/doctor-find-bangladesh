import "server-only";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { randomBytes } from "node:crypto";

// Cloudflare R2 image storage (S3-compatible API).
// DB stores only the object `key` + public `url`; replacing an image always
// deletes the previous R2 object FIRST so the bucket never accumulates orphans.

let client: S3Client | null = null;

function r2(): S3Client {
  if (client) return client;
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 credentials missing: set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY in .env");
  }
  client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return client;
}

function bucket(): string {
  const b = process.env.R2_BUCKET;
  if (!b) throw new Error("R2_BUCKET is not set");
  return b;
}

function publicBase(): string {
  const base = process.env.R2_PUBLIC_URL;
  if (!base) throw new Error("R2_PUBLIC_URL is not set (your r2.dev or custom domain)");
  return base.replace(/\/$/, "");
}

export type UploadedImage = { key: string; url: string };

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/svg+xml": "svg",
};

function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } {
  const match = /^data:(image\/[a-z+.-]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) throw new Error("Invalid image data URL");
  return { mime: match[1], buffer: Buffer.from(match[2], "base64") };
}

// Upload a data-URL image. When `replaceKey` is given, that object is
// permanently deleted from R2 before the new one is written.
export async function uploadImage(
  dataUrl: string,
  folder: string,
  replaceKey?: string | null
): Promise<UploadedImage> {
  if (replaceKey) {
    await destroyImage(replaceKey);
  }
  const { mime, buffer } = parseDataUrl(dataUrl);
  const ext = EXT_BY_MIME[mime] || "bin";
  const key = `doctorbondhu/${folder}/${Date.now()}-${randomBytes(6).toString("hex")}.${ext}`;

  await r2().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: buffer,
      ContentType: mime,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  return { key, url: `${publicBase()}/${key}` };
}

// Permanent delete at the R2 level. Safe to call with a missing key.
export async function destroyImage(key: string | null | undefined): Promise<void> {
  if (!key) return;
  try {
    await r2().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
  } catch {
    // A missing remote object must never block a save/delete flow.
  }
}
