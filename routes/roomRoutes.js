import express from 'express';
import { createRoom, getRooms, uploadRoomPhoto } from '../controllers/roomController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.get('/rooms', authMiddleware, getRooms);
router.post('/rooms', authMiddleware, createRoom);
router.post('/upload/room-photo', authMiddleware, upload.single("image"), uploadRoomPhoto);

export default router;
