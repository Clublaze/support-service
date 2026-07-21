import { S3Client, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dotenv from 'dotenv';
import AppError from './AppError.js';

dotenv.config();

const config = {
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  bucketName: process.env.AWS_S3_BUCKET_NAME,
  baseUrl: process.env.AWS_S3_BASE_URL,
};

const isAwsConfigured = () => {
  return config.region && config.accessKeyId && config.secretAccessKey && config.bucketName;
};

let s3Client = null;

const getClient = () => {
  if (s3Client) return s3Client;
  if (!isAwsConfigured()) {
    throw new AppError('Object storage is not configured. Please contact an administrator.', 503);
  }

  s3Client = new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return s3Client;
};

const getS3BaseUrl = () => {
  if (config.baseUrl) return config.baseUrl;
  return `https://${config.bucketName}.s3.${config.region}.amazonaws.com`;
};

const withRetry = async (operation, description, retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === retries) {
        console.error(`[S3] ${description} failed after ${retries} attempts:`, error);
        throw error;
      }
      const delay = Math.pow(2, attempt) * 100;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

const contentDispositionFor = (key) => {
  const filename = key.split('/').pop()?.replace(/["\\]/g, '') || 'document.pdf';
  return `inline; filename="${filename}"`;
};

export const uploadFile = async (buffer, key, mimeType) => {
  const client = getClient();

  await withRetry(
    () => new Upload({
      client,
      params: {
        Bucket: config.bucketName,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        ContentDisposition: contentDispositionFor(key),
      },
    }).done(),
    `S3 upload ${key}`
  );

  return `${getS3BaseUrl()}/${key}`;
};

export const deleteFile = async (key) => {
  const client = getClient();

  await withRetry(
    () => client.send(new DeleteObjectCommand({
      Bucket: config.bucketName,
      Key: key,
    })),
    `S3 delete ${key}`
  );
};

export const getSignedDownloadUrl = async (key, expiresInSeconds = 24 * 60 * 60, responseContentDisposition) => {
  const client = getClient();

  const responseHeaders = responseContentDisposition
    ? { ResponseContentDisposition: responseContentDisposition }
    : {};

  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      ...responseHeaders,
    }),
    { expiresIn: expiresInSeconds }
  );
};

export const extractKeyFromUrl = (url) => {
  if (!url) return null;

  try {
    return new URL(url).pathname.slice(1);
  } catch {
    return null;
  }
};
