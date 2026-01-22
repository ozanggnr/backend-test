import express from 'express';
import { createRoom, getRooms, uploadRoomPhoto, keepRoom, getSavedRooms } from '../controllers/roomController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.get('/rooms', authMiddleware, getRooms);
router.post('/rooms', authMiddleware, createRoom);
router.post('/upload/room-photo', authMiddleware, upload.single("image"), uploadRoomPhoto);
router.post('/rooms/:roomId/keep', authMiddleware, keepRoom);
router.get('/rooms/saved', authMiddleware, getSavedRooms);

export default router;
