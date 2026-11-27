const User = require("../models/user");
const Chatbot = require("../models/chatbot");
const Chat = require("../models/chat");
const Message = require("../models/message");
const UsageLog = require("../models/usageLog");
const Feedback = require("../models/feedback");

// GET /api/admin/analytics
exports.getAnalytics = async (req, res) => {
  try {
    const questionActions = ["chat_message", "stream_message", "regenerate"];

    const [
      totalUsers,
      activeUsers,
      totalChatbots,
      activeChatbots,
      totalConversations,
      totalMessages,
      questionStatsAgg,
      chatbotUsageAgg,
      chatCountByBotAgg,
      feedbackSummaryAgg,
      feedbackByBotAgg,
      modelUsageAgg,
      allChatbots,
      recentActivity
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      Chatbot.countDocuments({ isDeleted: false }),
      Chatbot.countDocuments({ isDeleted: false, isActive: true }),
      Chat.countDocuments(),
      Message.countDocuments(),
      UsageLog.aggregate([
        { $match: { action: { $in: questionActions } } },
        {
          $group: {
            _id: null,
            totalQuestions: { $sum: 1 },
            inDomainCount: {
              $sum: {
                $cond: [{ $eq: ["$classificationStatus", "IN_DOMAIN"] }, 1, 0]
              }
            },
            outOfDomainCount: {
              $sum: {
                $cond: [{ $eq: ["$classificationStatus", "OUT_OF_DOMAIN"] }, 1, 0]
              }
            },
            ambiguousCount: {
              $sum: {
                $cond: [{ $eq: ["$classificationStatus", "AMBIGUOUS"] }, 1, 0]
              }
            },
            avgResponseTimeMs: { $avg: "$responseTimeMs" }
          }
        }
      ]),
      UsageLog.aggregate([
        {
          $match: {
            action: { $in: questionActions },
            chatbotId: { $ne: null }
          }
        },
        {
          $group: {
            _id: "$chatbotId",
            totalQuestions: { $sum: 1 },
            inDomainCount: {
              $sum: {
                $cond: [{ $eq: ["$classificationStatus", "IN_DOMAIN"] }, 1, 0]
              }
            },
            outOfDomainCount: {
              $sum: {
                $cond: [{ $eq: ["$classificationStatus", "OUT_OF_DOMAIN"] }, 1, 0]
              }
            },
            ambiguousCount: {
              $sum: {
                $cond: [{ $eq: ["$classificationStatus", "AMBIGUOUS"] }, 1, 0]
              }
            },
            avgResponseTimeMs: { $avg: "$responseTimeMs" }
          }
        }
      ]),
      Chat.aggregate([
        { $match: { chatbotId: { $ne: null } } },
        { $group: { _id: "$chatbotId", conversationCount: { $sum: 1 } } }
      ]),
      Feedback.aggregate([
        {
          $group: {
            _id: null,
            totalFeedback: { $sum: 1 },
            positiveCount: {
              $sum: { $cond: [{ $eq: ["$rating", "positive"] }, 1, 0] }
            },
            negativeCount: {
              $sum: { $cond: [{ $eq: ["$rating", "negative"] }, 1, 0] }
            }
          }
        }
      ]),
      Feedback.aggregate([
        { $match: { chatbotId: { $ne: null } } },
        {
          $group: {
            _id: "$chatbotId",
            positiveCount: {
              $sum: { $cond: [{ $eq: ["$rating", "positive"] }, 1, 0] }
            },
            negativeCount: {
              $sum: { $cond: [{ $eq: ["$rating", "negative"] }, 1, 0] }
            }
          }
        }
      ]),
      UsageLog.aggregate([
        {
          $match: {
            action: { $in: questionActions },
            model: { $ne: null }
          }
        },
        {
          $group: {
            _id: "$model",
            count: { $sum: 1 },
            avgResponseTimeMs: { $avg: "$responseTimeMs" }
          }
        },
        { $sort: { count: -1 } }
      ]),
      Chatbot.find({ isDeleted: false })
        .select("name slug model isActive createdAt")
        .lean(),
      UsageLog.find()
        .populate("userId", "name email")
        .populate("chatbotId", "name slug")
        .sort({ createdAt: -1 })
        .limit(15)
        .lean()
    ]);

    const questionSummary = questionStatsAgg[0] || {
      totalQuestions: 0,
      inDomainCount: 0,
      outOfDomainCount: 0,
      ambiguousCount: 0,
      avgResponseTimeMs: 0
    };

    const feedbackSummary = feedbackSummaryAgg[0] || {
      totalFeedback: 0,
      positiveCount: 0,
      negativeCount: 0
    };

    const usageMap = new Map(
      chatbotUsageAgg.map((item) => [String(item._id), item])
    );
    const chatCountMap = new Map(
      chatCountByBotAgg.map((item) => [String(item._id), item.conversationCount])
    );
    const feedbackBotMap = new Map(
      feedbackByBotAgg.map((item) => [String(item._id), item])
    );

    const chatbotUsage = allChatbots.map((bot) => {
      const idStr = String(bot._id);
      const usage = usageMap.get(idStr) || {};
      const fb = feedbackBotMap.get(idStr) || {};
      return {
        chatbotId: bot._id,
        name: bot.name,
        slug: bot.slug,
        model: bot.model,
        isActive: bot.isActive,
        conversationCount: chatCountMap.get(idStr) || 0,
        totalQuestions: usage.totalQuestions || 0,
        inDomainCount: usage.inDomainCount || 0,
        outOfDomainCount: usage.outOfDomainCount || 0,
        ambiguousCount: usage.ambiguousCount || 0,
        avgResponseTimeMs: Math.round(usage.avgResponseTimeMs || 0),
        positiveFeedback: fb.positiveCount || 0,
        negativeFeedback: fb.negativeCount || 0
      };
    });

    return res.status(200).json({
      success: true,
      overview: {
        totalUsers,
        activeUsers,
        totalChatbots,
        activeChatbots,
        totalConversations,
        totalMessages,
        totalQuestions: questionSummary.totalQuestions,
        inDomainQuestions: questionSummary.inDomainCount,
        outOfDomainQuestions: questionSummary.outOfDomainCount,
        ambiguousQuestions: questionSummary.ambiguousCount,
        avgResponseTimeMs: Math.round(questionSummary.avgResponseTimeMs || 0),
        feedback: {
          total: feedbackSummary.totalFeedback,
          positive: feedbackSummary.positiveCount,
          negative: feedbackSummary.negativeCount
        }
      },
      chatbotUsage,
      modelUsage: modelUsageAgg.map((m) => ({
        model: m._id,
        count: m.count,
        avgResponseTimeMs: Math.round(m.avgResponseTimeMs || 0)
      })),
      recentActivity
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET /api/admin/users
exports.getUsersSummary = async (req, res) => {
  try {
    const users = await User.find()
      .select("-password")
      .populate("selectedChatbotId", "name slug")
      .sort({ createdAt: -1 })
      .lean();

    const chatCounts = await Chat.aggregate([
      { $group: { _id: "$userId", count: { $sum: 1 } } }
    ]);
    const countMap = new Map(chatCounts.map((c) => [String(c._id), c.count]));

    const enriched = users.map((u) => ({
      ...u,
      conversationCount: countMap.get(String(u._id)) || 0
    }));

    return res.status(200).json({
      success: true,
      total: enriched.length,
      users: enriched
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
