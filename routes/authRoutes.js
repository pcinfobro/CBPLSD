import passport from 'passport';
import express from 'express';
import { googleSignInController } from '../controllers/authController.js';

const router = express.Router();

router.get("/google", passport.authenticate('google', { 
    scope: ['email', 'profile'] 
}));

router.get(
    "/google/callback",
    passport.authenticate("google", {
        successRedirect: process.env.CLIENT_URL,
        failureRedirect: "/login/failed",
    })
);

router.get("/login/success", googleSignInController.signInSuccess);
router.get("/login/failed", googleSignInController.signInFailed);

export default router;