// Session cleanup middleware to prevent session bloat
export const sessionCleanup = (req, res, next) => {
    // Limit session data size to prevent memory issues
    if (req.session) {
        // Clean up old cached user data (older than 10 minutes)
        if (req.session.userData && req.session.userData.lastFetch) {
            const age = Date.now() - req.session.userData.lastFetch;
            if (age > 600000) { // 10 minutes
                delete req.session.userData;
            }
        }

        // Remove temporary data that shouldn't persist
        delete req.session.tempData;
        delete req.session.flashMessages;

        // Limit session object size
        const sessionStr = JSON.stringify(req.session);
        if (sessionStr.length > 50000) { // ~50KB limit
            console.warn('Session size exceeded limit, cleaning up');
            // Keep only essential data
            const essential = {
                userEmail: req.session.userEmail,
                passport: req.session.passport,
                userData: req.session.userData
            };
            Object.keys(req.session).forEach(key => {
                if (!essential.hasOwnProperty(key)) {
                    delete req.session[key];
                }
            });
        }
    }
    next();
};

// Memory monitoring middleware
export const memoryMonitor = (req, res, next) => {
    // Log memory usage periodically (only in development)
    if (process.env.NODE_ENV === 'development') {
        const memUsage = process.memoryUsage();
        if (memUsage.heapUsed > 100 * 1024 * 1024) { // 100MB threshold
            console.warn('High memory usage detected:', {
                heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
                heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
                rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB'
            });
        }
    }
    next();
};

// Request timeout middleware to prevent hanging requests
export const requestTimeout = (timeout = 30000) => {
    return (req, res, next) => {
        const timer = setTimeout(() => {
            if (!res.headersSent) {
                res.status(408).json({
                    error: 'Request timeout',
                    message: 'The request took too long to process'
                });
            }
        }, timeout);

        // Clear timeout when response is sent
        res.on('finish', () => {
            clearTimeout(timer);
        });

        next();
    };
};
