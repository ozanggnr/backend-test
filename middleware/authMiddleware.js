import jwt from 'jsonwebtoken';

export function authMiddleware(req, res, next) {
    try {
        const auth = req.headers.authorization || '';
        const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

        if (!token) {
            return res.status(401).json({ error: 'Missing token' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // { userId, email, ... }
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

export const verifyToken = (req, res, next) => {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

    if (!token) {
        return res.status(401).json({ error: 'Missing token' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: 'Invalid token' });
        }
        req.user = decoded; // { userId, email, ... }
        next();
    });
};
