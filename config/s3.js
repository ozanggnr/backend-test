import { S3Client } from "@aws-sdk/client-s3";

// Ensure env vars are loaded before importing this if possible, 
// strictly speaking in ES modules imports happen first, so ensure 'dotenv/config' is used at entry point.

export const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});
