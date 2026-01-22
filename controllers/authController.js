import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import { getDB } from '../config/db.js';
import { validateEmail, validatePhoneNumber } from '../utils/validation.js';

function signToken(payload) {
    const secret = process.env.JWT_SECRET;
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    return jwt.sign(payload, secret, { expiresIn });
}

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

export async function signup(req, res) {
    try {
        const { name, email, password, phone, countryCode } = req.body;
        const db = getDB();
        const users = db.collection(process.env.COLLECTION_USERS || 'Users');

        if (!email || typeof email !== 'string' || !validateEmail(email)) {
            return res.status(400).json({ error: 'Please enter a valid email' });
        }

        if (!password || typeof password !== 'string' || password.length < 6) {
            return res.status(400).json({ error: 'password must be at least 6 characters' });
        }

        let validatedPhone = null;
        if (phone && countryCode) {
            const phoneValidation = await validatePhoneNumber(phone, countryCode);
            if (!phoneValidation || !phoneValidation.isValid) {
                return res.status(400).json({
                    error: 'invalid phone number',
                    details: phoneValidation ? `Phone number is not valid for ${countryCode}` : 'Phone validation service unavailable'
                });
            }
            validatedPhone = phoneValidation.e164Format;
        }

        const displayName = typeof name === 'string' ? name.trim() : null;

        const existing = await users.findOne({ email });
        if (existing) return res.status(409).json({ error: 'email already in use' });

        const passwordHash = await bcrypt.hash(password, 10);
        const doc = {
            name: displayName,
            email,
            passwordHash,
            phone: validatedPhone,
            createdAt: new Date()
        };

        const result = await users.insertOne(doc);

        const token = signToken({ userId: result.insertedId.toString(), email });
        res.json({
            user: {
                id: result.insertedId.toString(),
                name: displayName,
                email,
                phone: validatedPhone
            },
            token
        });
    } catch (e) {
        console.error('Signup error:', e);
        res.status(500).json({ error: 'Failed to sign up' });
    }
}

export async function login(req, res) {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

        const db = getDB();
        const users = db.collection(process.env.COLLECTION_USERS || 'Users');

        const user = await users.findOne({ email });
        if (!user) return res.status(401).json({ error: 'invalid credentials' });

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return res.status(401).json({ error: 'invalid credentials' });

        const token = signToken({ userId: user._id.toString(), email: user.email });
        res.json({
            user: { id: user._id.toString(), name: user.name ?? null, email: user.email },
            token
        });
    } catch (e) {
        console.error('Login error:', e);
        res.status(500).json({ error: 'Failed to login' });
    }
}

export async function getMe(req, res) {
    try {
        const { userId } = req.user;
        const db = getDB();
        const users = db.collection(process.env.COLLECTION_USERS || 'Users');

        const user = await users.findOne({ _id: new ObjectId(userId) }, { projection: { passwordHash: 0 } });
        if (!user) return res.status(404).json({ error: 'not found' });
        res.json({ user: { id: user._id.toString(), name: user.name ?? null, email: user.email, createdAt: user.createdAt } });
    } catch (e) {
        console.error('Get Me error:', e);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
}

export async function verifyEmail(req, res) {
    try {
        const { token } = req.query;
        if (!token) return res.status(400).json({ error: 'Invalid token' });

        const db = getDB();
        const users = db.collection(process.env.COLLECTION_USERS || 'Users');

        const user = await users.findOne({
            emailVerifyToken: token,
            emailVerifyExpires: { $gt: new Date() }
        });

        if (!user) {
            return res.status(400).json({ error: 'Token expired or invalid' });
        }

        await users.updateOne(
            { _id: user._id },
            {
                $set: { emailVerified: true },
                $unset: { emailVerifyToken: '', emailVerifyExpires: '' }
            }
        );

        res.json({ ok: true });
    } catch (e) {
        console.error('Verify Email error:', e);
        res.status(500).json({ error: 'Failed to verify email' });
    }
}

export async function passwordResetRequest(req, res) {
    try {
        const { email } = req.body;
        const db = getDB();
        const users = db.collection(process.env.COLLECTION_USERS || 'Users');

        const user = await users.findOne({ email });
        if (!user) return res.json({ ok: true });

        const token = generateToken();

        await users.updateOne(
            { _id: user._id },
            {
                $set: {
                    passwordResetToken: token,
                    passwordResetExpires: new Date(Date.now() + 1000 * 60 * 30)
                }
            }
        );

        console.log(`RESET PASSWORD LINK: http://localhost:5173/reset-password?token=${token}`);
        res.json({ ok: true });
    } catch (e) {
        console.error('Password Reset Request error:', e);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export async function passwordReset(req, res) {
    try {
        const { token, newPassword } = req.body;

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: 'Weak password' });
        }

        const db = getDB();
        const users = db.collection(process.env.COLLECTION_USERS || 'Users');

        const user = await users.findOne({
            passwordResetToken: token,
            passwordResetExpires: { $gt: new Date() }
        });

        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired token' });
        }

        const hash = await bcrypt.hash(newPassword, 10);

        await users.updateOne(
            { _id: user._id },
            {
                $set: { passwordHash: hash },
                $unset: { passwordResetToken: '', passwordResetExpires: '' }
            }
        );

        res.json({ ok: true });
    } catch (e) {
        console.error('Password Reset error:', e);
        res.status(500).json({ error: 'Internal server error' });
    }
}
