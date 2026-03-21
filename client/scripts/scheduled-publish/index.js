import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, cpSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mime from "mime";
import { S3Client, PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import {
  CloudFrontClient,
  CreateInvalidationCommand,
} from "@aws-sdk/client-cloudfront";

const __dirname = path.dirname(fileURLToPath(import.meta.url)); // workaround to get current directory in ES module context
const CLIENT_DIR = process.env.SCHEDULED_PUBLISH_CLIENT_DIR || path.resolve(__dirname, "../..");
const OUT_DIR = path.join(CLIENT_DIR, "out");
const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;

// Build Next.js app into static files
function build() {
  console.log("Running next.js build...");
  try {
    execSync("npm run build", {
      cwd: CLIENT_DIR,
      stdio: "inherit",
    });
    console.log("Build completed successfully.");
    return true;
  } catch (error) {
    console.error("Build failed:", error.message);
    return false;
  }
}

// Fetch all existing S3 object ETags into a Map<key, etag>
async function getExistingETags(s3, bucket, prefix) {
  const etags = new Map();
  let continuationToken;

  do {
    const params = { Bucket: bucket, MaxKeys: 1000 };
    if (prefix) params.Prefix = prefix;
    if (continuationToken) params.ContinuationToken = continuationToken;

    const response = await s3.send(new ListObjectsV2Command(params));

    for (const obj of response.Contents || []) {
      // ETags are quoted strings like '"abc123..."', strip quotes
      etags.set(obj.Key, obj.ETag.replace(/"/g, ""));
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  return etags;
}

// Upload all our build Next.js static output to s3
async function uploadToS3() {
  const bucket = process.env.SCHEDULED_PUBLISH_S3_BUCKET;
  if (!bucket) {
    console.error("SCHEDULED_PUBLISH_S3_BUCKET environment variable is not set. Skipping upload.");
    return;
  }

  const prefix = process.env.SCHEDULED_PUBLISH_S3_PREFIX || "";

  console.log(`Uploading files to S3 bucket ${bucket} with prefix "${prefix}"...`);

  const s3 = new S3Client();

  // Fetch existing ETags to skip unchanged files
  let existingETags = new Map();
  try {
    existingETags = await getExistingETags(s3, bucket, prefix || undefined);
    console.log(`Found ${existingETags.size} existing objects in S3.`);
  } catch (error) {
    console.warn(`Could not list existing S3 objects, will upload all files: ${error.message}`);
  }

  const files = readdirSync(OUT_DIR, { recursive: true });
  let uploaded = 0;
  let skipped = 0;
  let errors = 0;

  for (const relativePath of files) {
    const fullPath = path.join(OUT_DIR, relativePath);

    if (!statSync(fullPath).isFile()) {
      continue;
    }

    const key = prefix
      ? `${prefix}/${relativePath}`
      : relativePath.toString();

    try {
      const body = readFileSync(fullPath);

      // Compare local MD5 with existing S3 ETag
      const localMd5 = createHash("md5").update(body).digest("hex");
      const remoteETag = existingETags.get(key);

      if (remoteETag === localMd5) {
        skipped++;
        continue;
      }

      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: mime.getType(fullPath) || "application/octet-stream",
        })
      );
      uploaded++;
    } catch (error) {
      console.error(`Failed to upload ${relativePath}:`, error.message);
      errors++;
    }
  }

  console.log(
    `Upload complete: ${uploaded} uploaded, ${skipped} skipped (unchanged), ${errors} errors.`
  );

  if (uploaded > 0) {
    await invalidateCloudFront();
  }
}

// Invalidate CloudFront so that the newly uploaded content will be served without waiting for cache.
async function invalidateCloudFront() {
  const distributionId = process.env.SCHEDULED_PUBLISH_CLOUDFRONT_DISTRIBUTION_ID;
  if (!distributionId) {
    console.error(
      "SCHEDULED_PUBLISH_CLOUDFRONT_DISTRIBUTION_ID environment variable is not set. Skipping invalidation."
    );
    return;
  }

  const cloudfront = new CloudFrontClient();

  console.log(`Invalidating CloudFront distribution ${distributionId}...`);

  try {
    const result = await cloudfront.send(
      new CreateInvalidationCommand({
        DistributionId: distributionId,
        InvalidationBatch: {
          CallerReference: Date.now().toString(),
          Paths: {
            Quantity: 1,
            Items: ["/*"],
          },
        },
      })
    );
    console.log(
      `CloudFront invalidation created: ${result.Invalidation?.Id}`
    );
  } catch (error) {
    console.error("CloudFront invalidation failed:", error.message);
  }
}

// Ensures all downloaded thumbnails are there even if the code isn't referencing them
function ensureDownloadsInOutput() {
  const publicDownloads = path.join(CLIENT_DIR, "public", "downloads");
  const outDownloads = path.join(OUT_DIR, "downloads");

  if (!existsSync(publicDownloads)) {
    console.log("No public/downloads directory found, skipping copy.");
    return;
  }

  console.log("Copying downloads into build output...");
  cpSync(publicDownloads, outDownloads, { recursive: true, force: true });
  console.log("Downloads copied to output directory.");
}

async function run() {
  const now = new Date();
  console.log("=".repeat(60));
  console.log(`Scheduled publish: ${now.toISOString()}`);
  console.log("=".repeat(60));

  const buildOk = build();

  if (buildOk) {
    ensureDownloadsInOutput();
    await uploadToS3();
  }

  const nextRun = new Date(Date.now() + EIGHT_HOURS_MS);
  console.log(`Next run scheduled for: ${nextRun.toISOString()}`);
  setTimeout(run, EIGHT_HOURS_MS);
}

run();
