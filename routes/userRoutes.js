import express from 'express';
import { uploadProfileImage } from '../controllers/userController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.post('/upload/profile', authMiddleware, upload.single("image"), uploadProfileImage);

export default router;
