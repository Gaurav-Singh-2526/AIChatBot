const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema(
    {
        userId:{
            type:mongoose.Schema.Types.ObjectId,
            ref:"User",
            require:true,
            index:true
        },
        title:{
            type:String,
            trim:true,
            default:"New Chat",
            maxlength:100
        },
        model:{
            type:String,
            default:"ollama3"
        },
        isArchived:{
            type:Boolean,
            default:false
        }
    },
    {
        timestamps:true
    }
);

chatSchema.index({ userId:1,updatedAt:-1});

module.exports = mongoose.model("Chat",chatSchema);