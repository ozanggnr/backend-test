import express from 'express';
import {
    signup,
    login,
    getMe,
    verifyEmail,
    passwordResetRequest,
    passwordReset
} from '../controllers/authController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.get('/me', authMiddleware, getMe);
router.get('/auth/verify-email', verifyEmail); // verify-email was originally under /auth/verify-email directly in server.js but without /auth prefix? No, it was `app.get('/auth/verify-email'...)`
router.post('/auth/password-reset-request', passwordResetRequest);
router.post('/auth/password-reset', passwordReset);

// Note: In server.js we will mount this router. 
// If we mount at '/', precise paths should match original server.js.
// Original: 
// app.post('/signup'...) -> matched by router.post('/signup'...) if mounted at '/'
// app.get('/auth/verify-email'...) -> matched by router.get('/auth/verify-email'...) if mounted at '/'

export default router;
