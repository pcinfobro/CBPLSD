export const protectedRoute = (handler) => async (req, res, next) => {
    const email = req.session.userEmail;
    if (!email) {
        // Set headers to prevent caching
        res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
        res.header('Expires', '-1');
        res.header('Pragma', 'no-cache');
        return res.redirect('/user/signin');
    }
    
    try {
        // Check if user data is already available from session cache
        if (req.session.userData && req.session.userData.user) {
            // Verify user still exists if cache is older than 5 minutes
            if (Date.now() - req.session.userData.lastFetch > 300000) {
                const user = await User.findOne({ email }).lean();
                if (!user) {
                    req.session.destroy();
                    return res.redirect('/user/signin');
                }
                
                if (!user.isVerified) {
                    req.session.destroy();
                    return res.redirect('/user/signin?message=Please verify your email first');
                }
                
                // Update cache
                req.session.userData.lastFetch = Date.now();
                req.user = user;
            } else {
                // Use cached data and fetch full user object
                req.user = await User.findOne({ email }).lean();
            }
        } else {
            // First time or no cache - fetch user
            const user = await User.findOne({ email }).lean();
            if (!user) {
                req.session.destroy();
                return res.redirect('/user/signin');
            }
            
            if (!user.isVerified) {
                req.session.destroy();
                return res.redirect('/user/signin?message=Please verify your email first');
            }
            
            req.user = user;
        }

        // Add cache control headers to all protected responses
        res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
        res.header('Expires', '-1');
        res.header('Pragma', 'no-cache');
        return await handler(req, res);
    } catch (error) {
        next(error);
    }
};
    // In middlewares/authMiddleware.js

const checkBalance = async (req, res, next) => {
  try {
    // Use cached user data if available, otherwise fetch from database
    let user;
    if (req.user) {
      user = req.user;
    } else {
      user = await User.findOne({ email: req.session.userEmail }).lean();
    }
    
    if (!user) {
      return res.status(401).json({ error: true, message: "Unauthorized" });
    }

    // Attach user balance to request for easy access
    req.userBalance = user.balance || 0;
    next();
  } catch (error) {
    next(error);
  }
};

};