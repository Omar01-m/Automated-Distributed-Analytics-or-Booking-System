import express from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const CORE_SERVICE_URL = 'http://localhost:8080';
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_microservice_key_matrix';

// In-Memory User Storage (For demonstration purposes)
const users = [];

// -------------------------------------------------------------------------
// AUTHENTICATION ROUTES
// -------------------------------------------------------------------------

// 1. User Registration
app.post('/auth/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        
        // Hash the password so it's never stored in plain text
        const hashedPassword = await bcrypt.hash(password, 10);
        users.push({ username, password: hashedPassword });
        
        res.status(201).json({ message: 'User registered successfully!' });
    } catch (error) {
        res.status(500).json({ error: 'Registration failed' });
    }
});

// 2. User Login (Issues JWT Token)
app.post('/auth/login', async (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username);
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: 'Invalid security credentials' });
    }

    // Sign a token containing the user identity that expires in 1 hour
    const token = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
});

// -------------------------------------------------------------------------
// SECURITY MIDDLEWARE
// -------------------------------------------------------------------------
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Extract "TOKEN" from "Bearer TOKEN"

    if (!token) {
        return res.status(401).json({ error: 'Access denied. Missing token header.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token security signature' });
        }
        req.user = user; // Inject the user context into the request object
        next(); // Pass control to the routing controller
    });
}

// -------------------------------------------------------------------------
// PROTECTED REVERSE PROXY ROUTE
// -------------------------------------------------------------------------
// Pre-pend the authenticateToken middleware to lock down this route matrix
app.all(['/orders', /^\/orders\/.+/], authenticateToken, async (req, res) => {
    try {
        const targetUrl = `${CORE_SERVICE_URL}${req.originalUrl}`;
        
        const response = await axios({
            method: req.method,
            url: targetUrl,
            data: req.body,
            headers: req.headers
        });

        res.status(response.status).json(response.data);
    } catch (error) {
        if (error.response) {
            res.status(error.response.status).json(error.response.data);
        } else {
            res.status(500).json({ error: 'Core Service is currently unreachable' });
        }
    }
});

app.listen(PORT, () => {
    console.log(`[Gateway Service] Running securely on port ${PORT}`);
});