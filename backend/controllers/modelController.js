const { listOllamaModels } = require("../services/ollamaServices");

exports.getModels = async (req, res) => {
  const defaultModel = process.env.OLLAMA_MODEL || "qwen2.5:3b";
  try {
    const models = await listOllamaModels();
    const names = models.map((m) => m.name);
    if (!names.includes(defaultModel)) {
      models.unshift({ name: defaultModel, size: null, modifiedAt: null });
    }
    return res.status(200).json({
      success: true,
      ollamaReachable: true,
      defaultModel,
      models
    });
  } catch (_error) {
    return res.status(200).json({
      success: true,
      ollamaReachable: false,
      defaultModel,
      models: [{ name: defaultModel, size: null, modifiedAt: null }]
    });
  }
};
