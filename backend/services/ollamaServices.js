const axios = require("axios");

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";

exports.generateAIResponse = async({model,messages})=>{
    const response  = await axios.post(
        `${OLLAMA_BASE_URL}/api/chat`,
        {
            model,
            messages,
            stream:false,
            options:{
                temperature:0.7
            }
        },
        {
            timeout:120000
        }

    );

    const content = response.data?.message?.content?.trim();

    if(!content){
        throw new Error("ollama returned an empty response");
    }
    return content;
};