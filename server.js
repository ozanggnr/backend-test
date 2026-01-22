import 'dotenv/config'; // Must be first
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { connectDB } from './config/db.js';

import authRoutes from './routes/authRoutes.js';
import roomRoutes from './routes/roomRoutes.js';
import userRoutes from './routes/userRoutes.js';
import calendarRoutes from './routes/calendarRoutes.js';

const app = express();

// Middleware
app.use(cors({
    origin: '*',
    credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/', authRoutes);
app.use('/', roomRoutes);
app.use('/', userRoutes);
app.use('/', calendarRoutes);

// Start Server
const port = Number(process.env.PORT) || 3000;

connectDB().then(() => {
    app.listen(port, () => {
        console.log(`API listening on http://localhost:${port}`);
    });
}).catch(err => {
    console.error('Failed to init server', err);
    process.exit(1);
});
