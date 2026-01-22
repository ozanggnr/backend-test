import multer from 'multer';

// Use memory storage to process files directly or upload to S3
const storage = multer.memoryStorage();

export const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // Limit file size to 10MB
    }
});
