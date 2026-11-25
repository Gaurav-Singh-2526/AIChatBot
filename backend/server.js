
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());  

// Database connection
connectDB();

// Swagger API Documentation
app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec)
);
// Authentication routes
app.use("/api/auth",require("./routes/authRoutes"));

// Test route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "AI Chatbot API is running!"
  });
});
//chats and messages 
app.use("/api/chats",require("./routes/chatRoutes"))
app.use("/api/messages",require("./routes/messageRoutes"));
// Server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Swagger Docs: http://localhost:${PORT}/api-docs`);
});
