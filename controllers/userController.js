import { ObjectId } from 'mongodb';
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3 } from '../config/s3.js';
import { getDB } from '../config/db.js';

export async function uploadProfileImage(req, res) {
    try {
        const file = req.file;
        if (!file) return res.status(400).json({ error: "No file uploaded" });

        const key = `profiles/${req.user.userId}-${Date.now()}`;
        const bucket = process.env.AWS_S3_BUCKET;
        const region = process.env.AWS_REGION; // Assuming region is needed for URL construction

        await s3.send(
            new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: file.buffer,
                ContentType: file.mimetype
            })
        );

        const imageUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

        const db = getDB();
        const users = db.collection(process.env.COLLECTION_USERS || 'Users');

        await users.updateOne(
            { _id: new ObjectId(req.user.userId) },
            { $set: { profileImage: imageUrl } }
        );

        res.json({ imageUrl });
    } catch (err) {
        console.error('Upload Profile Image error:', err);
        res.status(500).json({ error: "S3 upload failed" });
    }
}
