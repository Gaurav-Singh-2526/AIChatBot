const http = require("http");
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const { ensureDefaultChatbots } = require("./utils/seedChatbots");
const { initSocketServer } = require("./services/socketService");

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Swagger API Documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Test route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "AI Chatbot API is running!"
  });
});

// Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/chatbots", require("./routes/chatbotRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/chats", require("./routes/chatRoutes"));
app.use("/api/messages", require("./routes/messageRoutes"));
app.use("/api/messages/stream", require("./routes/streamRoutes"));
app.use("/api/models", require("./routes/modelRoutes"));
app.use("/api/feedback", require("./routes/feedbackRoutes"));
app.use("/api/users", require("./routes/userRoutes"));

// Error handling
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const API_URL = process.env.API_URL || `http://localhost:${PORT}`;

if (require.main === module) {
  const httpServer = http.createServer(app);
  initSocketServer(httpServer);

  connectDB().then(async () => {
    try {
      const seedResult = await ensureDefaultChatbots();
      if (seedResult.seeded > 0) {
        console.log(`Seeded ${seedResult.seeded} default domain chatbots.`);
      }
    } catch (err) {
      console.error("Chatbot seeding skipped:", err.message);
    }

    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Swagger Docs: ${API_URL}/api-docs`);
      console.log("Socket.IO enabled with JWT authentication");
    });
  });
}

module.exports = app;
