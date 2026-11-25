const express = require("express");
const router = express.Router();

const{
    registerUser,
    LoginUser,
    loginUser
}=require("../controllers/authController")

const {protect} = require("../midddleware/authMiddleWare");

router.post("/register",registerUser);
router.post("/login",loginUser);

router.get("/me",protect,(req,res)=>{
    res.status(200).json({
        success:true,
        user:{
            id:req.user._id,
            name:req.user.name,
            email: req.user.email,
            role: req.user.role
        }
    })
});
module.exports = router