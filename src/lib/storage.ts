import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";

const provider = process.env.STORAGE_PROVIDER ?? "local";

function getS3() {
  return new S3Client({
    region: process.env.AWS_REGION ?? "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function createUploadUrl(
  fileName: string,
  mimeType: string
): Promise<{ uploadUrl: string; storageKey: string }> {
  const storageKey = `uploads/${randomUUID()}/${fileName}`;

  if (provider === "s3") {
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: storageKey,
      ContentType: mimeType,
    });
    const uploadUrl = await getSignedUrl(getS3(), command, { expiresIn: 3600 });
    return { uploadUrl, storageKey };
  }

  if (provider === "supabase") {
    const supabase = getSupabase();
    const { data, error } = await supabase.storage
      .from(process.env.SUPABASE_STORAGE_BUCKET ?? "qlass-uploads")
      .createSignedUploadUrl(storageKey);
    if (error) throw error;
    return { uploadUrl: data.signedUrl, storageKey };
  }

  return {
    uploadUrl: `/api/uploads/local?key=${encodeURIComponent(storageKey)}`,
    storageKey,
  };
}

export async function getDownloadUrl(storageKey: string): Promise<string> {
  if (provider === "s3") {
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: storageKey,
    });
    return getSignedUrl(getS3(), command, { expiresIn: 3600 });
  }

  if (provider === "supabase") {
    const supabase = getSupabase();
    const { data } = await supabase.storage
      .from(process.env.SUPABASE_STORAGE_BUCKET ?? "qlass-uploads")
      .createSignedUrl(storageKey, 3600);
    return data?.signedUrl ?? "";
  }

  return `/api/uploads/local?key=${encodeURIComponent(storageKey)}&download=1`;
}

/**
 * Server-side upload of raw bytes (used by the Google Classroom import to copy
 * Drive attachments). Unlike createUploadUrl, this writes directly rather than
 * handing a presigned URL to the browser.
 */
export async function putObject(
  storageKey: string,
  buffer: Buffer,
  mimeType: string
): Promise<void> {
  if (provider === "s3") {
    await getS3().send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: storageKey,
        Body: buffer,
        ContentType: mimeType,
      })
    );
    return;
  }

  if (provider === "supabase") {
    const supabase = getSupabase();
    const { error } = await supabase.storage
      .from(process.env.SUPABASE_STORAGE_BUCKET ?? "qlass-uploads")
      .upload(storageKey, buffer, { contentType: mimeType, upsert: true });
    if (error) throw error;
    return;
  }

  await saveLocalFile(storageKey, buffer);
}

export async function saveLocalFile(
  storageKey: string,
  buffer: Buffer
): Promise<void> {
  const uploadDir = process.env.UPLOAD_DIR ?? "./uploads";
  const fullPath = path.join(uploadDir, storageKey);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, buffer);
}

export async function readLocalFile(storageKey: string): Promise<Buffer> {
  const uploadDir = process.env.UPLOAD_DIR ?? "./uploads";
  return fs.readFile(path.join(uploadDir, storageKey));
}
