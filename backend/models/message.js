const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
    {
        chatId: {
            type:mongoose.Schema.Types.ObjectId,
            ref:"Chat",
            required:true,
            index: true
        },
        userId:{
            type: mongoose.Schema.Types.ObjectId,
            ref:"User",
            required:true,
            index:true
        },
        role:{
            type:String,
            enum:["user","assistant","system"],
            required:true           
        },
        content:{
            type:String,
            required:true
        },
        model:{
            type:String,
            default:null
        }
    },
    {
        timestamps:true
    }

);

messageSchema.index({chatId:1,createdAt:-1});

module.exports = mongoose.model("message",messageSchema);