const express = require("express");
const router = express.Router();

const{
    registerUser,
    loginUser
}=require("../controllers/authController")

const { protect } = require("../middleware/authMiddleware");
const { createRateLimiter } = require("../middleware/rateLimitMiddleware");

const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 40,
  message: "Too many authentication attempts. Please try again later."
});

router.post("/register", authRateLimiter, registerUser);
router.post("/login", authRateLimiter, loginUser);

router.get("/me",protect,(req,res)=>{
    res.status(200).json({
        success:true,
        user:{
            id:req.user._id,
            name:req.user.name,
            email: req.user.email,
            role: req.user.role,
            selectedChatbotId: req.user.selectedChatbotId || null
        }
    })
});
module.exports = router