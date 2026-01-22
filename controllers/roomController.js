import { ObjectId } from 'mongodb';
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3 } from '../config/s3.js';
import { getDB } from '../config/db.js';

export async function createRoom(req, res) {
    try {
        const { userId, email } = req.user;
        const {
            name,
            capsuleDays = 0,
            capsuleHours = 0,
            capsuleMinutes = 0,
            isPublic = true,
            isCollaboration = false
        } = req.body;

        if (!name || typeof name !== 'string') {
            return res.status(400).json({ error: 'name is required' });
        }

        const db = getDB();
        const rooms = db.collection(process.env.COLLECTION_ROOMS || 'AryaColl');

        const doc = {
            name,
            ownerId: new ObjectId(userId),
            ownerEmail: email ?? null,
            createdAt: new Date(),
            photos: [], // Initialize photos array
            capsuleDays: parseInt(capsuleDays),
            capsuleHours: parseInt(capsuleHours),
            capsuleMinutes: parseInt(capsuleMinutes),
            isPublic: !!isPublic,
            isCollaboration: !!isCollaboration
        };

        const result = await rooms.insertOne(doc);
        res.json({ id: result.insertedId.toString() });
    } catch (e) {
        console.error('Create Room error:', e);
        res.status(500).json({ error: 'Failed to create room' });
    }
}

export async function getRooms(req, res) {
    try {
        const { userId } = req.user;
        const db = getDB();
        const rooms = db.collection(process.env.COLLECTION_ROOMS || 'AryaColl');

        const docs = await rooms.find({ ownerId: new ObjectId(userId) }).sort({ createdAt: -1 }).toArray();
        res.json(docs);
    } catch (e) {
        console.error('Get Rooms error:', e);
        res.status(500).json({ error: 'Failed to fetch rooms' });
    }
}

export async function uploadRoomPhoto(req, res) {
    try {
        console.log('--- Upload Room Photo Request ---');
        console.log('Req Body:', req.body);
        console.log('Req File:', req.file ? `Present (${req.file.originalname}, ${req.file.mimetype}, ${req.file.size} bytes)` : 'MISSING');

        const file = req.file;
        const { roomId } = req.body;

        if (!file) {
            console.error('Upload failed: No file uploaded');
            return res.status(400).json({ error: "No file uploaded" });
        }

        if (!roomId) {
            console.error('Upload failed: Room ID required');
            return res.status(400).json({ error: "Room ID required" });
        }

        // Validate ObjectId
        if (!ObjectId.isValid(roomId)) {
            console.error('Upload failed: Invalid Room ID format', roomId);
            return res.status(400).json({ error: "Invalid Room ID" });
        }

        const key = `rooms/${roomId}/${Date.now()}-${file.originalname}`;
        const bucket = process.env.AWS_S3_BUCKET;
        const region = process.env.AWS_REGION;

        if (!bucket || !region) {
            console.error('Server Logic Error: Missing AWS Config', { bucket, region });
            return res.status(500).json({ error: "Server misconfiguration (AWS)" });
        }

        console.log(`Uploading to S3. Bucket: ${bucket}, Key: ${key}`);

        await s3.send(
            new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: file.buffer,
                ContentType: file.mimetype
            })
        );

        const imageUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
        console.log('S3 Upload success. URL:', imageUrl);

        const db = getDB();
        const rooms = db.collection(process.env.COLLECTION_ROOMS || 'AryaColl');

        const updateResult = await rooms.updateOne(
            { _id: new ObjectId(roomId) },
            { $push: { photos: imageUrl } }
        );

        if (updateResult.modifiedCount === 0) {
            console.warn('DB Update Warning: Room not found or not modified for ID:', roomId);
            // We still return success if the file was uploaded, but maybe warn? 
            // Or if the room doesn't exist, we might have uploaded an orphan file.
        } else {
            console.log('DB Updated successfully.');
        }

        res.json({ imageUrl });
    } catch (err) {
        console.error('Upload Room Photo Critical Error:', err);
        res.status(500).json({ error: "S3 upload failed", details: err.message });
    }
}
