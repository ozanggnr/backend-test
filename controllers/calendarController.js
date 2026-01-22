import { google } from 'googleapis';
import { getDB } from '../config/db.js';

// Load credentials from environment
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback';

const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
);

// Get Auth URL
export const getAuthUrl = (req, res) => {
    const scopes = [
        'https://www.googleapis.com/auth/calendar.events.readonly'
    ];

    // Pass user ID as state to link token on callback if needed, 
    // OR we can just return the URL and let the client handle opening it.
    // For a backend-driven flow:
    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        state: req.user ? req.user.userId : 'unknown'
    });

    res.json({ url });
};

// Handle Callback
export const oauth2Callback = async (req, res) => {
    try {
        const { code, state } = req.query;
        // Verify state (userId) if implementing strict CSRF/Linking

        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Save tokens to User document
        // Ideally, we secure this by ensuring the user is authenticated, 
        // but the callback comes from Google. The 'state' parameter is key here.
        // For MVP, we'll assume the state corresponds to the userId passed in getAuthUrl.

        if (state && state !== 'unknown') {
            const db = getDB();
            const users = db.collection(process.env.COLLECTION_USERS || 'Users');

            // Store tokens securely. process.env.COLLECTION_USERS
            // You might want to encrypt the refresh token.
            await users.updateOne(
                { _id: new import('mongodb').ObjectId(state) },
                { $set: { googleTokens: tokens } }
            );
        }

        // Ideally redirect back to the app via a custom scheme deep link
        // e.g. bestbefore://calendar-connected
        res.redirect('bestbefore://calendar-connected?status=success');
    } catch (e) {
        console.error('OAuth Callback Error:', e);
        res.status(500).send('Authentication failed');
    }
};

// Fetch Events
export const getEvents = async (req, res) => {
    try {
        const { userId } = req.user;
        const db = getDB();
        const users = db.collection(process.env.COLLECTION_USERS || 'Users');

        const user = await users.findOne({ _id: new import('mongodb').ObjectId(userId) });

        if (!user || !user.googleTokens) {
            return res.status(401).json({ error: 'Google Calendar not connected' });
        }

        oauth2Client.setCredentials(user.googleTokens);

        // Handle token refresh automatically by googleapis
        // If refresh fails (revoked), we should handle that flow (catch error -> 401).

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        const response = await calendar.events.list({
            calendarId: 'primary',
            timeMin: (new Date()).toISOString(),
            maxResults: 20,
            singleEvents: true,
            orderBy: 'startTime',
        });

        const events = response.data.items.map(event => ({
            id: event.id,
            title: event.summary || 'No Title',
            start: event.start.dateTime || event.start.date,
            end: event.end.dateTime || event.end.date,
            description: event.description,
            location: event.location
        }));

        res.json({ events });

    } catch (e) {
        console.error('Fetch Events Error:', e);
        // If "invalid_grant", tokens might be expired/revoked
        res.status(500).json({ error: 'Failed to fetch events' });
    }
};
