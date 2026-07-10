import express from 'express';
import axios from 'axios';
import 'dotenv/config';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const CORE_SERVICE_URL = 'http://localhost:8080';

// Health Check Endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'Gateway is up and running securely' });
});

// Reverse Proxy Route: Forward all /orders traffic to the Spring Boot Core Service

// This catches exactly "/orders" and anything matching "/orders/..." using a clean RegExp
app.all(['/orders', /^\/orders\/.+/], async (req, res) => {    try {
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