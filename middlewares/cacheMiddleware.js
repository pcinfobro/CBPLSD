// Cache busting middleware to force refresh static assets
export const cacheBusting = (req, res, next) => {
    // Add cache busting query parameter to static assets
    const originalRender = res.render;
    res.render = function(view, options = {}) {
        // Add cache buster to locals
        options.cacheBuster = Date.now();
        return originalRender.call(this, view, options);
    };
    next();
};

// Force clear cache headers for development
export const developmentCache = (req, res, next) => {
    if (process.env.NODE_ENV === 'development') {
        res.setHeader('Cache-Control', 'no-store, no-cache, private, must-revalidate, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');
        res.setHeader('X-Accel-Expires', '0');
    }
    next();
};
