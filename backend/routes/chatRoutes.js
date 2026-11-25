const express = require("express");
const router = express.Router();

const {
    createChat,
    getAllChats,
    getChatById,
    renameChat,
    deleteChat,
    clearChatMessages

} = require("../controllers/chatController");
const { protect } = require("../midddleware/authMiddleWare");

router.use(protect);
//create new chat
router.post("/", createChat);

//Get all chats
router.get("/", getAllChats);

//Get chat By Id
router.get("/:chatId", getChatById);

//Rename chat
router.patch("/:chatId", renameChat);

//Delete chat
router.delete("/:chatId", deleteChat);

//Clear message
router.delete("/:chatId/messages", clearChatMessages);

module.exports = router;