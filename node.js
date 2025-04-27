const express = require('express');
const mongoose = require('mongoose');
const winston = require('winston');

const app = express();
app.use(express.json());

// Logger setup
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
        new winston.transports.Console()
    ]
});

// MongoDB connection
mongoose.connect('mongodb+srv://jiosaavn:jiosaavn@cluster0.ouhhe.mongodb.net/imageGallery?retryWrites=true&w=majority', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000 // Timeout for initial connection
}).then(() => {
    logger.info('Connected to MongoDB');
}).catch(err => {
    logger.error('MongoDB connection error:', err);
});

// MongoDB Schema
const imageSchema = new mongoose.Schema({
    imageUrl: { type: String, required: true },
    captions: [{
        text: { type: String, required: true },
        url: { type: String, required: true }
    }],
    createdAt: { type: Date, default: Date.now }
});

// Create text index for search
imageSchema.index({ 'captions.text': 'text' });

const Image = mongoose.model('Image', imageSchema);

// Middleware for error handling
app.use((err, req, res, next) => {
    logger.error(`${req.method} ${req.url} - Error: ${err.message}`, { stack: err.stack });
    res.status(500).json({ error: err.message });
});

// Get images
app.get('/api/images', async (req, res, next) => {
    try {
        const search = req.query.search;
        let images;
        if (search) {
            images = await Image.find({ $text: { $search: search } });
        } else {
            images = await Image.find().sort({ createdAt: -1 });
        }
        res.json(images);
    } catch (error) {
        logger.error('Error fetching images:', error);
        next(error);
    }
});

// Create image
app.post('/api/images', async (req, res, next) => {
    try {
        const { imageUrl, captions } = req.body;
        if (!imageUrl || !captions || !Array.isArray(captions) || captions.length === 0) {
            throw new Error('Invalid input: imageUrl and at least one caption required');
        }

        // Validate URLs
        try {
            new URL(imageUrl);
            captions.forEach((cap, index) => {
                new URL(cap.url);
            });
        } catch {
            throw new Error('Invalid URL provided');
        }

        const image = new Image({ imageUrl, captions });
        await image.save();
        logger.info('Image saved to MongoDB:', image._id);
        res.json(image);
    } catch (error) {
        logger.error('Error saving image:', error);
        next(error);
    }
});

// Update image
app.put('/api/images/:id', async (req, res, next) => {
    try {
        const { imageUrl, captions } = req.body;
        if (!imageUrl || !captions || !Array.isArray(captions) || captions.length === 0) {
            throw new Error('Invalid input: imageUrl and at least one caption required');
        }

        // Validate URLs
        try {
            new URL(imageUrl);
            captions.forEach((cap, index) => {
                new URL(cap.url);
            });
        } catch {
            throw new Error('Invalid URL provided');
        }

        const image = await Image.findByIdAndUpdate(req.params.id, { imageUrl, captions }, { new: true });
        if (!image) {
            throw new Error('Image not found');
        }
        logger.info('Image updated in MongoDB:', image._id);
        res.json(image);
    } catch (error) {
        logger.error('Error updating image:', error);
        next(error);
    }
});

// Delete image
app.delete('/api/images/:id', async (req, res, next) => {
    try {
        const image = await Image.findByIdAndDelete(req.params.id);
        if (!image) {
            throw new Error('Image not found');
        }
        logger.info('Image deleted from MongoDB:', req.params.id);
        res.json({ success: true });
    } catch (error) {
        logger.error('Error deleting image:', error);
        next(error);
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
});
