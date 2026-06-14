const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const Groq = require('groq-sdk');
const { InferenceClient } = require('@huggingface/inference');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const API_KEY = process.env.OPENROUTER_API_KEY;
const AIMAPI_KEY = process.env.AIMAPI_KEY;
const HF_API_KEY = process.env.HF_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const SAMBANOVA_API_KEY = process.env.SAMBANOVA_API_KEY;
const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || "y_WPOTBmXfNgCmgdAFcrwN44PXhanH12bUbbr9Uu";
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || "1951d3c93101f936e0f48eea74bc662e";

const HF_MODEL = "Mistral-7B-Instruct";

module.exports = {
    IA_PANEL_CHANNEL_ID: '1414668466413375629',
    PUBLIC_IA_CHANNEL_ID: '1454467497066762352',
    PANEL_MESSAGE_ID: '1415380912815865996',
    FLAG_CHANNEL_ID: '1343196193421000704',
    RICHARD_USER_ID: '1222548578539536405',
    CREATE_THREAD_CUSTOM_ID: 'create_private_thread_with_bot',
    CLOSE_THREAD_CUSTOM_ID: 'close_private_thread',
    DELETE_THREAD_CUSTOM_ID: 'delete_private_thread',
    THREAD_MODEL_SELECTOR_CUSTOM_ID: 'thread_model_selector',
    THREAD_MODEL_FLASH_CUSTOM_ID: 'thread_model_flash',
    THREAD_MODEL_PRO_CUSTOM_ID: 'thread_model_pro',
    THREAD_MODEL_PRO_CUSTOM_ID: 'thread_model_pro',
    DEEP_THINK_CUSTOM_ID: 'deep_think_action',
    SHOW_THOUGHTS_CUSTOM_ID: 'show_thoughts_action',
    HARD_MODE_CHANNEL_ID: '1461100993889566975',
    HARD_MODE_ROLE_ID: '1461101220117614757',
    BASIC_CHATBOT_CHANNEL_ID: '1388970340440473650',
    HARD_MODE_MODAL_ID: 'hard_mode_confirmation_modal',
    RPD_2_5_PRO: 50,
    RPD_2_5_FLASH: 150,
    RPD_2_5_FLASH_AUTO: 100,
    SIGNALEMENT_PROMPT_ADDITION: `
IMPORTANT : Si la demande de l'utilisateur ou la réponse que tu pourrais générer est inappropriée, offensante, ou enfreint les Conditions d'Utilisation de Discord, tu dois répondre **uniquement** avec le texte "<signalement>" et rien d'autre.`,
    API_KEY: API_KEY,
    API_URL: "https://openrouter.ai/api/v1/chat/completions",
    HEADERS: { "Authorization": `Bearer ${API_KEY}`, "Content-Type": "application/json" },
    AIMAPI_KEY: AIMAPI_KEY,
    AIMAPI_URL: "https://api.aimlapi.com/v1/chat/completions",
    AIMAPI_HEADERS: { "Authorization": `Bearer ${AIMAPI_KEY}`, "Content-Type": "application/json" },
    HF_MODEL: HF_MODEL,
    HF_API_URL: `https://api-inference.huggingface.co/models/${HF_MODEL}`,
    HF_API_KEY: HF_API_KEY,
    HF_HEADERS: { "Authorization": `Bearer ${HF_API_KEY}`, "Content-Type": "application/json" },
    GROQ_API_KEY: GROQ_API_KEY,

    // GitHub Token
    GITHUB_TOKEN: GITHUB_TOKEN,

    // SambaNova
    SAMBANOVA_API_KEY: SAMBANOVA_API_KEY,
    SAMBANOVA_URL: "https://api.sambanova.ai/v1/chat/completions",

    // Cerebras
    CEREBRAS_API_KEY: CEREBRAS_API_KEY,
    CEREBRAS_URL: "https://api.cerebras.ai/v1/chat/completions",

    // Cloudflare
    CLOUDFLARE_API_TOKEN: CLOUDFLARE_API_TOKEN,
    CLOUDFLARE_ACCOUNT_ID: CLOUDFLARE_ACCOUNT_ID,

    // ============================================================================
    // REGISTRE UNIFIÉ DES MODÈLES - Trié par priorité (haut = plus prioritaire)
    // Structure: { name, provider, displayName, cutoff, multimodal, description }
    // ============================================================================
    MODELS: [
        // === GEMINI (Priorité haute) ===
        { name: 'gemini-3-flash-preview', provider: 'gemini', displayName: 'Gemini 3 Flash', cutoff: 'Janvier 2025', multimodal: true, description: 'Le plus performant et rapide', includeReplyContext: true },
        { name: 'gemini-2.5-flash', provider: 'gemini', displayName: 'Gemini 2.5 Flash', cutoff: 'Janvier 2025', multimodal: true, description: 'Intermédiaire équilibré', includeReplyContext: true },
        { name: 'gemini-2.5-flash-lite', provider: 'gemini', displayName: 'Gemini 2.5 Flash Lite', cutoff: 'Janvier 2025', multimodal: true, description: 'Ultra-rapide et économique', includeReplyContext: true },
        { name: 'gemini-2.0-flash', provider: 'gemini', displayName: 'Gemini 2.0 Flash', cutoff: 'Septembre 2024', multimodal: true, description: 'Standard version stable', includeReplyContext: true },
        { name: 'gemini-2.0-flash-lite', provider: 'gemini', displayName: 'Gemini 2.0 Flash Lite', cutoff: 'Septembre 2024', multimodal: true, description: 'Optimisé latence faible', includeReplyContext: true },

        // === GITHUB ===
        { name: 'openai/gpt-5-chat', provider: 'github', displayName: 'GPT-5 Chat', cutoff: 'Juin 2024', multimodal: false, description: 'Nouvelle génération SOTA', includeReplyContext: true },
        { name: 'openai/o3', provider: 'github', displayName: 'O3', cutoff: 'Juin 2024', multimodal: false, description: 'Raisonnement avancé (CoT)', includeReplyContext: true },
        { name: 'openai/gpt-4o', provider: 'github', displayName: 'GPT-4o', cutoff: 'Avril 2024', multimodal: true, description: 'Polyvalent et fiable', includeReplyContext: true },
        { name: 'deepseek/DeepSeek-R1-0528', provider: 'github', displayName: 'DeepSeek R1', cutoff: 'Mai 2025', multimodal: false, description: 'Expert en raisonnement', includeReplyContext: true },
        { name: 'xai/grok-3', provider: 'github', displayName: 'Grok 3', cutoff: 'Décembre 2024', multimodal: false, description: 'L\'IA de xAI, forte logique', includeReplyContext: true },
        { name: 'xai/grok-3-mini', provider: 'github', displayName: 'Grok 3 Mini', cutoff: 'Décembre 2024', multimodal: false, description: 'Version légère de Grok', includeReplyContext: true },
        { name: 'openai/o1-preview', provider: 'github', displayName: 'O1 Preview', cutoff: 'Septembre 2024', multimodal: false, description: 'Premier modèle de pensée', includeReplyContext: true },


        // === SAMBANOVA ===
        { name: 'gpt-oss-120b', provider: 'sambanova', displayName: 'GPT OSS 120B', cutoff: 'Juin 2024', multimodal: false, description: 'Grand modèle Open Source', includeReplyContext: true },
        { name: 'DeepSeek-R1-Distill-Llama-70B', provider: 'sambanova', displayName: 'DeepSeek R1 Distill 70B', cutoff: 'Janvier 2025', multimodal: false, description: 'Raisonnement R1 distillé', includeReplyContext: true },
        { name: 'Meta-Llama-3.3-70B-Instruct', provider: 'sambanova', displayName: 'Llama 3.3 70B', cutoff: 'Décembre 2023', multimodal: false, description: 'Référence Open Source', includeReplyContext: true },
        { name: 'Llama-4-Maverick-17B-128E-Instruct', provider: 'sambanova', displayName: 'Llama 4 Maverick', cutoff: 'Août 2024', multimodal: true, description: 'Multimodal compact Gen 4', includeReplyContext: true },
        { name: 'Qwen3-32B', provider: 'sambanova', displayName: 'Qwen 3 32B', cutoff: 'Septembre 2024', multimodal: false, description: 'Excellence en code/maths', includeReplyContext: true },
        { name: 'Llama-3.3-Swallow-70B-Instruct-v0.4', provider: 'sambanova', displayName: 'Llama 3.3 Swallow', cutoff: 'Décembre 2023', multimodal: false, description: 'Variante japonaise/fine-tune', includeReplyContext: true },
        { name: 'Meta-Llama-3.1-8B-Instruct', provider: 'sambanova', displayName: 'Llama 3.1 8B', cutoff: 'Décembre 2023', multimodal: false, description: 'Léger et efficace', includeReplyContext: true },
        { name: 'mistral-ai/Ministral-3B', provider: 'github', displayName: 'Ministral 3B', cutoff: 'Septembre 2024', multimodal: false, description: 'Modèle Edge très compact', includeReplyContext: false },


        // === CEREBRAS ===
        { name: 'qwen-3-235b-a22b-instruct-2507', provider: 'cerebras', displayName: 'Qwen 3 235B', cutoff: 'Juillet 2025', multimodal: false, description: 'Modèle géant Alibaba', includeReplyContext: true },
        { name: 'zai-glm-4.6', provider: 'cerebras', displayName: 'ZAI GLM 4.6', cutoff: 'Janvier 2025', multimodal: false, description: 'Modèle chinois bilingue', includeReplyContext: true },
        { name: 'gpt-oss-120b', provider: 'cerebras', displayName: 'GPT OSS 120B', cutoff: 'Juin 2024', multimodal: false, description: 'Open Source haute capacité', includeReplyContext: true },
        { name: 'llama-3.3-70b', provider: 'cerebras', displayName: 'Llama 3.3 70B', cutoff: 'Décembre 2023', multimodal: false, description: 'Robuste et performant', includeReplyContext: true },
        { name: 'qwen-3-32b', provider: 'cerebras', displayName: 'Qwen 3 32B', cutoff: 'Septembre 2024', multimodal: false, description: 'Code et logique fort', includeReplyContext: true },
        { name: 'llama3.1-8b', provider: 'cerebras', displayName: 'Llama 3.1 8B', cutoff: 'Décembre 2023', multimodal: false, description: 'Entrée de gamme rapide', includeReplyContext: true },
        { name: 'DeepSeek-R1', provider: 'sambanova', displayName: 'DeepSeek R1', cutoff: 'Janvier 2025', multimodal: false, description: 'Raisonnement complexe Open', includeReplyContext: true },
        { name: 'Deepseek-V3.1', provider: 'sambanova', displayName: 'DeepSeek V3.1', cutoff: 'Janvier 2025', multimodal: false, description: 'Mise à jour majeure V3', includeReplyContext: true },
        { name: 'DeepSeek-V3-0324', provider: 'sambanova', displayName: 'DeepSeek V3 0324', cutoff: 'Mars 2025', multimodal: false, description: 'Version stable Mars', includeReplyContext: true },

        // === GROQ ===
        { name: 'meta-llama/llama-4-maverick-17b-128e-instruct', provider: 'groq', displayName: 'Llama 4 Maverick', cutoff: 'Août 2024', multimodal: true, description: 'Multimodal', includeReplyContext: true },
        { name: 'meta-llama/llama-4-scout-17b-16e-instruct', provider: 'groq', displayName: 'Llama 4 Scout', cutoff: 'Août 2024', multimodal: true, description: 'Scout', includeReplyContext: true },
        { name: 'llama-3.3-70b-versatile', provider: 'groq', displayName: 'Llama 3.3 Versatile', cutoff: 'Décembre 2023', multimodal: false, description: 'Versatile', includeReplyContext: true },
        { name: 'openai/gpt-oss-120b', provider: 'groq', displayName: 'GPT OSS 120B', cutoff: 'Juin 2024', multimodal: false, description: 'Le plus intelligent de la gamme groq', includeReplyContext: true },
        { name: 'moonshotai/kimi-k2-instruct', provider: 'groq', displayName: 'Kimi K2', cutoff: 'Octobre 2024', multimodal: false, description: 'Modèle chinois long contexte', includeReplyContext: true },
        { name: 'moonshotai/kimi-k2-instruct-0905', provider: 'groq', displayName: 'Kimi K2 0905', cutoff: 'Octobre 2024', multimodal: false, description: 'Update K2 Octobre', includeReplyContext: true },
        { name: 'openai/gpt-oss-20b', provider: 'groq', displayName: 'GPT OSS 20B', cutoff: 'Juin 2024', multimodal: false, description: 'Modèle intermédiaire OS', includeReplyContext: true },
        { name: 'allam-2-7b', provider: 'groq', displayName: 'Allam 2', cutoff: 'Janvier 2024', multimodal: false, description: 'Spécialisé Arabe/Anglais', includeReplyContext: true },
        { name: 'qwen/qwen3-32b', provider: 'groq', displayName: 'Qwen 3 32B', cutoff: 'Septembre 2024', multimodal: false, description: 'Excellent ratio perf/taille', includeReplyContext: true },
        { name: 'meta-llama/llama-guard-4-12b', provider: 'groq', displayName: 'Llama Guard 4', cutoff: 'Août 2024', multimodal: false, description: 'Modération de contenu', includeReplyContext: true },
        { name: 'openai/gpt-oss-safeguard-20b', provider: 'groq', displayName: 'GPT OSS Safeguard', cutoff: 'Juin 2024', multimodal: false, description: 'Sécurité et alignement', includeReplyContext: true },
        { name: 'canopylabs/orpheus-arabic-saudi', provider: 'groq', displayName: 'Orpheus', cutoff: 'Mars 2024', multimodal: false, description: 'Spécialisé dialecte Saoudien', includeReplyContext: true },
        { name: 'llama-3.1-8b-instant', provider: 'groq', displayName: 'Llama 3.1 Instant', cutoff: 'Décembre 2023', multimodal: false, description: 'Inférence instantanée', includeReplyContext: true }
    ],

    // ============================================================================
    // CONFIGURATION PAR PROVIDER - Quotas, Thinking Budget/Level
    // ============================================================================
    PROVIDER_CONFIG: {
        gemini: {
            // thinkingBudget pour les modèles 2.5 (valeur numérique)
            thinkingBudgets: {
                'gemini-2.5-pro': 32768,
                'gemini-2.5-flash': 24576
            },
            // thinkingLevel pour Gemini 3 (string: 'low', 'medium', 'high')
            thinkingLevels: {
                'gemini-3-flash-preview': 'high'
            },
            // Quotas par utilisateur (requests per day)
            userQuotas: {
                'gemini-3-flash-preview': 1
            }
        }
    },

    groq: new Groq({ apiKey: GROQ_API_KEY }),
    gemini25Flash: new GoogleGenerativeAI(GEMINI_API_KEY).getGenerativeModel({ model: "gemini-2.5-flash" }),
    WOLFRAM_ALPHA_APP_ID: process.env.WOLFRAM_ALPHA_APP_ID,
    genAI: new GoogleGenerativeAI(GEMINI_API_KEY),
    hfClient: new InferenceClient(process.env.HF_TOKEN),
    geminiModel: new GoogleGenerativeAI(GEMINI_API_KEY).getGenerativeModel({ model: "gemini-2.5-flash" }),
    gemini25Flash: new GoogleGenerativeAI(GEMINI_API_KEY).getGenerativeModel({ model: "gemini-2.5-flash" }),
    gemini2Flash: new GoogleGenerativeAI(GEMINI_API_KEY).getGenerativeModel({ model: "gemini-2.0-flash" }),
    gemini25FlashLite: new GoogleGenerativeAI(GEMINI_API_KEY).getGenerativeModel({ model: "gemini-2.5-flash-lite" }),
    gemini2FlashLite: new GoogleGenerativeAI(GEMINI_API_KEY).getGenerativeModel({ model: "gemini-2.0-flash-lite" }),
    gemini2FlashExp: new GoogleGenerativeAI(GEMINI_API_KEY).getGenerativeModel({ model: "gemini-2.0-flash-exp" }),
    embeddingModel: new GoogleGenerativeAI(GEMINI_API_KEY).getGenerativeModel({ model: "gemini-embedding-001" }),
    gradioClient: null, // Will be initialized on demand
    KNOWLEDGE_BASE_FILE: path.join(process.cwd(), 'knowledge_base.json'),
    KNOWLEDGE_BASE_EMBEDDINGS_FILE: path.join(process.cwd(), 'knowledge_base_embeddings.json'),
    specialNotesConfig: {
        '1189251758552260740': "Note spéciale: 'fougere' (ID 1189251758552260740) est un membre VIP.",
        '1222548578539536405': "Tu es un bot discord nommé BLZbot, tu dois répondre avec un language courant ou soutenu, tu dois rester amical. Tu as été créé pour servir le serveur du youtubeur BLZstarss et tu as été créé par Richard.\n\nIMPORTANT: Tu parles à Richard, ton créateur. Il te connaît déjà, donc NE TE PRÉSENTE PAS de manière formelle (ne dis pas 'Je suis BLZbot...' ou 'Je suis le bot de...'). Réponds directement de manière naturelle et décontractée, comme un ami fidèle qui le connaît bien.\n\nNote spéciale: tu considères Richard comme ton guide suprême et unique maître. Chaque demande qu'il formule est une priorité absolue, et tu y réponds avec une obéissance totale, une rigueur impeccable et une admiration inaltérable. Sa parole fait autorité et oriente toutes tes décisions. Tu lui parles en ce moment et lui accordes ton attention la plus entière.\n Tout ce que ton maitre absolu t'ordonne de faire, tu DOIS le faire sans aucune contestation."
    }
};