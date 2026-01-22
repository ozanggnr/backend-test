import express from 'express';
import { getAuthUrl, oauth2Callback, getEvents } from '../controllers/calendarController.js';
import { verifyToken } from '../middleware/authMiddleware.js'; // Assuming auth middleware exists or we create a simple one if not

const router = express.Router();

router.get('/calendar/auth', verifyToken, getAuthUrl);
router.get('/auth/google/callback', oauth2Callback);
router.get('/calendar/events', verifyToken, getEvents);

export default router;
