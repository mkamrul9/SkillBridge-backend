import { Router } from "express";
import auth from "../../middlewares/auth";

const router = Router();

const isOpenRouterBase = (url: string) => /openrouter\.ai/i.test(url);

const parseProviderReason = (details: string) => {
    try {
        const parsed = JSON.parse(details);
        const message = parsed?.error?.message || parsed?.message;
        const code = parsed?.error?.code || parsed?.code;
        if (code && message) return `${code}: ${message}`;
        if (message) return String(message);
    } catch {
        // ignore non-JSON errors
    }
    return details.slice(0, 240);
};

const normalizeModelForProvider = (model: string, baseUrl: string) => {
    const trimmed = model.trim();
    if (!trimmed) return trimmed;

    if (isOpenRouterBase(baseUrl)) {
        if (trimmed.includes("/")) return trimmed;

        const openRouterMap: Record<string, string> = {
            "gpt-4.1-mini": "openai/gpt-4.1-mini",
            "gpt-4o-mini": "openai/gpt-4o-mini",
            "gpt-4.1-nano": "openai/gpt-4.1-nano",
            "gpt-3.5-turbo": "openai/gpt-3.5-turbo",
        };

        return openRouterMap[trimmed] || `openai/${trimmed}`;
    }

    return trimmed;
};

const buildFallbackReply = (prompt: string, providerReason?: string) => {
    const reasonLine = providerReason
        ? `Provider note: ${providerReason.slice(0, 220)}`
        : "Provider note: Please verify AI provider credentials and model access.";

    return [
        "I could not reach the AI provider right now, but I can still help with SkillBridge basics.",
        reasonLine,
        "Try these quick actions:",
        "1) Open Tutors to filter by category and rating.",
        "2) Use Dashboard to manage bookings and profile updates.",
        "3) Use Reviews to check tutor quality before booking.",
        `Your question: "${prompt.slice(0, 180)}"`,
    ].join("\n");
};

const getGeminiModelsForVersion = async (
    apiVersion: string,
    key: string,
    preferredModel: string,
    fallbackModels: string[],
) => {
    const normalizedPreferred = preferredModel.replace(/^models\//, "").trim();
    const normalizedFallback = fallbackModels.map((m) => m.replace(/^models\//, "").trim());

    const modelSet = new Set<string>([normalizedPreferred, ...normalizedFallback].filter(Boolean));

    try {
        const listRes = await fetch(
            `https://generativelanguage.googleapis.com/${apiVersion}/models?key=${encodeURIComponent(key)}`,
        );

        if (listRes.ok) {
            const listData: any = await listRes.json();
            const models: any[] = Array.isArray(listData?.models) ? listData.models : [];

            models.forEach((model) => {
                const rawName = String(model?.name || "");
                const name = rawName.replace(/^models\//, "").trim();
                const supportsGenerate = Array.isArray(model?.supportedGenerationMethods)
                    ? model.supportedGenerationMethods.includes("generateContent")
                    : true;

                if (name && supportsGenerate && name.toLowerCase().includes("gemini")) {
                    modelSet.add(name);
                }
            });
        }
    } catch {
        // If list call fails, we still continue with preferred + fallback models.
    }

    return Array.from(modelSet);
};

router.post("/chat", auth(), async (req, res) => {
    try {
        const userMessages = Array.isArray(req.body?.messages) ? req.body.messages : [];
        const lastUserMessage = userMessages
            .filter((msg: any) => msg?.role === "user" && typeof msg?.content === "string")
            .slice(-1)[0];

        if (!lastUserMessage?.content?.trim()) {
            return res.status(400).json({
                success: false,
                message: "A user message is required.",
            });
        }

        const geminiKey = String(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "")
            .trim()
            .replace(/^['\"]|['\"]$/g, "");
        const preferredGeminiModel = String(process.env.GEMINI_MODEL || "gemini-2.0-flash").trim();
        const geminiFallbackModels = [
            "gemini-2.0-flash",
            "gemini-2.0-flash-lite",
            "gemini-1.5-flash-latest",
            "gemini-1.5-pro-latest",
        ];
        const preferredGeminiApiVersion = String(process.env.GEMINI_API_VERSION || "v1beta").trim();
        const geminiApiVersionsToTry = Array.from(
            new Set([preferredGeminiApiVersion, "v1beta", "v1"].filter(Boolean)),
        );
        const promptText = String(lastUserMessage.content).slice(0, 4000);

        if (geminiKey) {
            let geminiDetails = "";
            let geminiReason = "";

            for (const apiVersion of geminiApiVersionsToTry) {
                const geminiModelsToTry = await getGeminiModelsForVersion(
                    apiVersion,
                    geminiKey,
                    preferredGeminiModel,
                    geminiFallbackModels,
                );

                for (const geminiModel of geminiModelsToTry) {
                    const geminiRes = await fetch(
                        `https://generativelanguage.googleapis.com/${apiVersion}/models/${encodeURIComponent(geminiModel)}:generateContent?key=${encodeURIComponent(geminiKey)}`,
                        {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                contents: [
                                    {
                                        role: "user",
                                        parts: [
                                            {
                                                text:
                                                    "You are SkillBridge Assistant. Help students and tutors with bookings, profiles, tutoring workflows, and platform usage. Keep answers concise and practical.\n\nUser question: " + promptText,
                                            },
                                        ],
                                    },
                                ],
                                generationConfig: {
                                    temperature: 0.5,
                                    maxOutputTokens: 500,
                                },
                            }),
                        },
                    );

                    if (geminiRes.ok) {
                        const geminiData: any = await geminiRes.json();
                        const geminiReply = (geminiData?.candidates?.[0]?.content?.parts || [])
                            .map((part: any) => part?.text)
                            .filter(Boolean)
                            .join("\n")
                            .trim();

                        if (geminiReply) {
                            return res.status(200).json({ success: true, data: { reply: geminiReply } });
                        }
                    } else {
                        const details = await geminiRes.text();
                        geminiDetails = `[version=${apiVersion}][model=${geminiModel}] ${details}`;
                        geminiReason = parseProviderReason(details) || `Gemini rejected ${geminiModel}`;
                    }
                }
            }

            // If Gemini is configured but fails, fall back to OpenAI if available.
            if (!process.env.OPENAI_API_KEY && !process.env.OPENAI_APIKEY && !process.env.OPENAI_KEY) {
                return res.status(200).json({
                    success: true,
                    data: {
                        reply: buildFallbackReply(promptText, geminiReason),
                        fallback: true,
                    },
                    warning: "Gemini provider request failed.",
                    details: geminiDetails.slice(0, 1000),
                });
            }
        }

        const apiKey = String(
            process.env.OPENAI_API_KEY ||
            process.env.OPENAI_APIKEY ||
            process.env.OPENAI_KEY ||
            "",
        )
            .trim()
            .replace(/^['\"]|['\"]$/g, "");
        const baseUrl = String(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").trim().replace(/\/+$/, "");

        if (!apiKey) {
            return res.status(200).json({
                success: true,
                data: {
                    reply:
                        "AI provider is not configured yet. Please set OPENAI_API_KEY in backend environment. Meanwhile, you can browse tutors, manage bookings, and update your profile from the dashboard.",
                    fallback: true,
                },
            });
        }

        const preferredModelRaw = String(process.env.OPENAI_MODEL || "gpt-4o-mini").trim();
        const fallbackModelsRaw = isOpenRouterBase(baseUrl)
            ? ["gpt-4.1-mini", "gpt-4o-mini", "gpt-4.1-nano"]
            : ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"];
        const modelsToTry = Array.from(
            new Set(
                [preferredModelRaw, ...fallbackModelsRaw]
                    .filter(Boolean)
                    .map((model) => normalizeModelForProvider(model, baseUrl)),
            ),
        );
        const baseHeaders: Record<string, string> = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        };

        if (process.env.OPENAI_PROJECT_ID) {
            baseHeaders["OpenAI-Project"] = process.env.OPENAI_PROJECT_ID;
        }

        if (process.env.OPENAI_ORGANIZATION) {
            baseHeaders["OpenAI-Organization"] = process.env.OPENAI_ORGANIZATION;
        }

        if (process.env.OPENAI_HTTP_REFERER) {
            baseHeaders["HTTP-Referer"] = process.env.OPENAI_HTTP_REFERER;
        }

        if (process.env.OPENAI_APP_TITLE) {
            baseHeaders["X-Title"] = process.env.OPENAI_APP_TITLE;
        }

        let lastErrorDetails = "";
        let lastProviderReason = "";

        for (const model of modelsToTry) {
            const completion = await fetch(`${baseUrl}/chat/completions`, {
                method: "POST",
                headers: baseHeaders,
                body: JSON.stringify({
                    model,
                    temperature: 0.5,
                    max_tokens: 500,
                    messages: [
                        {
                            role: "system",
                            content:
                                "You are SkillBridge Assistant. Help students and tutors with bookings, profiles, tutoring workflows, and platform usage. Keep answers concise and practical.",
                        },
                        {
                            role: "user",
                            content: promptText,
                        },
                    ],
                }),
            });

            if (!completion.ok) {
                const details = await completion.text();
                lastErrorDetails = `[model=${model}] ${details}`;
                lastProviderReason = parseProviderReason(details) || `chat/completions rejected model ${model}`;

                // Some providers expose only the Responses API. Try that before failing this model.
                const responsesRes = await fetch(`${baseUrl}/responses`, {
                    method: "POST",
                    headers: baseHeaders,
                    body: JSON.stringify({
                        model,
                        temperature: 0.5,
                        max_output_tokens: 500,
                        instructions:
                            "You are SkillBridge Assistant. Help students and tutors with bookings, profiles, tutoring workflows, and platform usage. Keep answers concise and practical.",
                        input: promptText,
                    }),
                });

                if (!responsesRes.ok) {
                    const responsesDetails = await responsesRes.text();
                    lastErrorDetails = `${lastErrorDetails}\n[model=${model}][responses] ${responsesDetails}`;
                    lastProviderReason = parseProviderReason(responsesDetails) || `responses rejected model ${model}`;
                    continue;
                }

                const responsesData: any = await responsesRes.json();
                const responseReply =
                    responsesData?.output_text?.trim() ||
                    responsesData?.output?.[0]?.content?.[0]?.text?.trim();

                if (responseReply) {
                    return res.status(200).json({ success: true, data: { reply: responseReply } });
                }

                lastErrorDetails = `${lastErrorDetails}\n[model=${model}][responses] Empty response`;
                lastProviderReason = `responses returned empty text for ${model}`;
                continue;
            }

            const data: any = await completion.json();
            const reply = data?.choices?.[0]?.message?.content?.trim();

            if (reply) {
                return res.status(200).json({ success: true, data: { reply } });
            }

            lastErrorDetails = `[model=${model}] Empty response`;
        }

        return res.status(200).json({
            success: true,
            data: {
                reply: buildFallbackReply(String(lastUserMessage.content || ""), lastProviderReason),
                fallback: true,
            },
            warning:
                "AI provider request failed. Check API key validity, billing/quota, project access, and model availability.",
            details: lastErrorDetails.slice(0, 1000),
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to generate AI response",
        });
    }
});

export default router;
