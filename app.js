import express from 'express';
import bodyParser from 'body-parser';
import ejsLayouts from 'express-ejs-layouts';
import path from 'path';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import compression from 'compression'; // Add compression import
import { cacheBusting, developmentCache } from './middlewares/cacheMiddleware.js';
import User from './models/userModel.js';
import { connectUsingMongoose } from './config/mongodb.js';
import router from './routes/routes.js';
import authRouter from './routes/authRoutes.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();

// Database connection
connectUsingMongoose();

// Development cache clearing (helps with browser cache issues)
app.use(developmentCache);

// Cache busting for templates
app.use(cacheBusting);

// Middleware
app.use(compression({
  level: 6, // Balanced compression
  threshold: 1024, // Only compress files larger than 1KB
  filter: (req, res) => {
    // Don't compress already compressed files
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Static file serving with optimized caching
app.use('/css', express.static('public/css', {
  maxAge: '7d', // Cache CSS for 7 days
  etag: true,
  immutable: true
}));

app.use('/js', express.static('public/js', {
  maxAge: '7d', // Cache JS for 7 days
  etag: true,
  immutable: true
}));

app.use('/assets', express.static('public/assets', {
  maxAge: '30d', // Cache images and other assets for 30 days
  etag: true,
  immutable: true
}));

app.use(express.static('public', {
  maxAge: '1d', // Cache other static files for 1 day
  etag: true
}));

// Optimized session configuration with MongoDB store
app.use(session({
  secret: process.env.SESSION_SECRET || 'SecretKey',
  resave: false,
  saveUninitialized: false, // Changed to false to avoid creating sessions for unauthenticated users
  rolling: true, // Reset session timeout on each request
  store: MongoStore.create({
    mongoUrl: process.env.DB_URL,
    touchAfter: 300, // Update session every 5 minutes instead of 24 hours
    autoRemove: 'native', // Let MongoDB handle session cleanup
    crypto: {
      secret: process.env.SESSION_SECRET || 'SecretKey'
    }
  }),
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 4 * 60 * 60 * 1000, // Reduced to 4 hours instead of 24
    sameSite: 'lax' // Better security
  }
}));

// Selective caching - only cache static assets, not dynamic content
app.use((req, res, next) => {
    // Allow caching for static assets
    if (req.url.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
        // Static assets can be cached
        res.setHeader('Cache-Control', 'public, max-age=604800'); // 7 days for assets
    } else {
        // Dynamic content should not be cached (security)
        res.setHeader('Cache-Control', 'no-store, no-cache, private, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '-1');
    }
    next();
});
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        status: 'error',
        message: err.message || 'Internal server error'
    });
});
// Passport config
app.use(passport.initialize());
app.use(passport.session());

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
    scope: ["profile", "email"],
}, (accessToken, refreshToken, profile, done) => done(null, profile)));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// View engine
app.set("view engine", "ejs");
app.use(ejsLayouts);
app.set("views", path.join(path.resolve(), "views"));

// Optimized User middleware - cache user data in session to avoid repeated DB queries
app.use(async (req, res, next) => {
    // Session health check - prevent hanging sessions
    if (req.session && req.session.userEmail) {
        console.log('Session middleware: Processing user session for:', req.session.userEmail);
        
        // Temporarily disable session age check to debug the login issue
        // TODO: Re-enable session age validation after fixing login
        /*
        const sessionCreatedAt = req.session.cookie._created || req.session.cookie.originalMaxAge;
        const sessionAge = sessionCreatedAt ? Date.now() - sessionCreatedAt : 0;
        
        console.log('Session check for user:', req.session.userEmail);
        console.log('Session age (minutes):', Math.round(sessionAge / 60000));
        
        if (sessionAge > 4 * 60 * 60 * 1000) { // 4 hours
            console.log('Session expired due to age, destroying session for user:', req.session.userEmail);
            req.session.destroy();
            res.locals.user = null;
            return next();
        }
        */

        // Check if user data is already cached in session
        if (req.session.userData && Date.now() - req.session.userData.lastFetch < 300000) { // 5 minutes cache
            res.locals.user = req.session.userData.user;
        } else {
            try {
                console.log('Middleware: Looking up user for email:', req.session.userEmail);
                const user = await User.findOne({ email: req.session.userEmail }).lean(); // Use lean() for better performance
                console.log('Middleware: User found in database:', user ? 'YES' : 'NO');
                if (user) {
                    console.log('Middleware: User data retrieved successfully');
                    const userData = {
                        username: user.username,
                        email: user.email,
                        balance: (user.balance || 0).toFixed(2),
                        role: user.role || 'Member'
                    };
                    res.locals.user = userData;
                    // Cache user data in session
                    req.session.userData = {
                        user: userData,
                        lastFetch: Date.now()
                    };
                } else {
                    console.log('Session expired, destroying session for user:', req.session.userEmail);
                    console.log('Reason: User not found in database - user may have been deleted or there is a database issue');
                    console.log('DEBUG: Checking if user exists with different query...');
                    
                    // Debug: Try to find user with additional logging
                    const debugUser = await User.findOne({ email: req.session.userEmail });
                    console.log('DEBUG: Raw user query result:', debugUser ? 'FOUND' : 'NOT FOUND');
                    if (debugUser) {
                        console.log('DEBUG: User exists but lean query failed. User active status:', debugUser.active);
                        console.log('DEBUG: User verified status:', debugUser.isVerified);
                    }
                    
                    req.session.destroy();
                    res.locals.user = null;
                }
            } catch (error) {
                console.error('User middleware error:', error);
                // Destroy corrupted session
                req.session.destroy();
                res.locals.user = null;
            }
        }
    } else {
        res.locals.user = null;
    }
    next();
});
// Single optimized error handling middleware
app.use((err, req, res, next) => {
    console.error('Application error:', {
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        url: req.originalUrl,
        method: req.method
    });
    
    // Check if response has already been sent
    if (res.headersSent) {
        return next(err);
    }
    
    // Set no-cache headers for error responses
    res.setHeader('Cache-Control', 'no-store, no-cache, private, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '-1');
    
    // Check if the error view exists
    const errorViewPath = path.join(__dirname, 'views', 'error.ejs');
    fs.access(errorViewPath, fs.constants.F_OK, (err) => {
        if (err) {
            // If error.ejs doesn't exist, send a simple error response
            res.status(500).send(`
                <h1>Something went wrong!</h1>
                <p>${err.message}</p>
                <a href="/">Return to Home</a>
            `);
        } else {
            // If error.ejs exists, render it
            res.status(500).render('error', { 
                message: err.message || 'Something went wrong!',
                error: process.env.NODE_ENV === 'development' ? err : {}
            });
        }
    });
});


// Routes
app.get('/', (req, res) => res.send('Hey Ninja! Go to /user/signin to see the magic.'));
app.use('/user', router);
app.use('/auth', authRouter);

// Error handling - moved after routes
// After all routes
app.use((err, req, res, next) => {
    console.error('Route error:', {
        message: err.message,
        url: req.originalUrl,
        method: req.method
    });
    
    if (res.headersSent) {
        return next(err);
    }
    
    res.status(500).render('error', { 
        message: err.message || 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

// Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

export default app;