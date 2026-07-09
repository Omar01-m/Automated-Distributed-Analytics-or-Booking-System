import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { createProxyMiddleware } from 'http-proxy-middleware';

dotenv.config();

const app = express();

// Middleware for parsing standard JSON payloads
app.use(express.json());
app.use(cors());

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const CORE_SERVICE_URL = process.env.CORE_SERVICE_URL || 'http://localhost:8080';

// Mock database for User Registration (Temporary storage for validation)
const users = [];

// --- Authentication Routes ---

// Registration Endpoint
app.post('/api/auth/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    
    const userExists = users.find(u => u.username === username);
    if (userExists) {
        return res.status(400).json({ error: 'User already exists' });
    }

    const newUser = { id: Date.now().toString(), username, password };
    users.push(newUser);
    
    return res.status(201).json({ message: 'User registered successfully', userId: newUser.id });
});

// Login Endpoint
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);

    if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Sign the JWT Token
    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
    return res.json({ token });
});

// --- Authentication Gatekeeper Middleware ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token missing' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// --- Secure Gateway Proxy Route ---
// Any requests sent to /api/orders will be validated here first, then sent to the Spring Boot app
app.use('/api/orders', authenticateToken, createProxyMiddleware({
    target: CORE_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
        '^/api/orders': '/orders', // Rewrites /api/orders/create to /orders/create on the target
    },
}));

export default app;