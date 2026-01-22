import { ObjectId } from "mongodb";

const mongoUri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME || 'bestBefore_TestDB';

let client;
let db;

export async function connectDB() {
    if (client) return db;

    try {
        console.log('Attempting to connect to MongoDB...');
        // Mask password in logs
        const maskedUri = mongoUri ? mongoUri.replace(/:([^:@]{1,})@/, ':****@') : 'UNDEFINED';
        console.log('URI:', maskedUri);

        client = new MongoClient(mongoUri);
        await client.connect();
        db = client.db(dbName);
        console.log('Connected to MongoDB, DB:', dbName);
        return db;
    } catch (err) {
        console.error('Failed to connect to MongoDB', err);
        process.exit(1);
    }
}

export function getDB() {
    if (!db) {
        throw new Error('Database not initialized. Call connectDB first.');
    }
    return db;
}
