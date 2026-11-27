const axios = require("axios");

const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL || process.env.OLLAMA_URL || "http://127.0.0.1:11434";

exports.generateAIResponse = async ({
  model,
  messages,
  options = {},
  format,
  signal,
  timeout = 120000
}) => {
  const payload = {
    model,
    messages,
    stream: false,
    options: {
      temperature: 0.7,
      ...options
    }
  };

  if (format) {
    payload.format = format;
  }

  const response = await axios.post(`${OLLAMA_BASE_URL}/api/chat`, payload, {
    timeout,
    signal
  });

  const content = response.data?.message?.content?.trim();

  if (!content) {
    throw new Error("Ollama returned an empty response");
  }

  return content;
};

exports.generateAIStream = async ({
  model,
  messages,
  signal,
  options = {}
}) => {
  const response = await axios.post(
    `${OLLAMA_BASE_URL}/api/chat`,
    {
      model,
      messages,
      stream: true,
      options: {
        temperature: 0.7,
        ...options
      }
    },
    {
      responseType: "stream",
      timeout: 0,
      signal
    }
  );

  return response.data;
};

exports.listOllamaModels = async () => {
  const response = await axios.get(`${OLLAMA_BASE_URL}/api/tags`, {
    timeout: 5000
  });
  return Array.isArray(response.data?.models)
    ? response.data.models.map((m) => ({
        name: m.name,
        size: m.size || null,
        modifiedAt: m.modified_at || null
      }))
    : [];
};
