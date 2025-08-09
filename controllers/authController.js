import User from "../models/userModel.js";

class GoogleSignInController {
    signInSuccess = async (req, res) => {
        const userData = req.user._json;
        const { email, name, sub } = userData;

        if (!email) {
            return res.status(403).json({ error: true, message: "Not Authorized" });
        }

        try {
            const user = await User.findOneAndUpdate(
                { email },
                { $setOnInsert: { username: name, email, password: sub } },
                { upsert: true, new: true }
            );
            
            req.session.userEmail = email;
            return res.status(200).render("index");
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: true, message: "Server error" });
        }
    }

    signInFailed = (req, res) => {
        res.status(401).json({
            error: true,
            message: "Log in failure",
        });
    }
}

export const googleSignInController = new GoogleSignInController();