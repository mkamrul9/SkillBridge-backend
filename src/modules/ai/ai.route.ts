import { Router } from "express";
import auth from "../../middlewares/auth";

const router = Router();

const buildFallbackReply = (prompt: string) => {
    return [
        "I could not reach the AI provider right now, but I can still help with SkillBridge basics.",
        "Try these quick actions:",
        "1) Open Tutors to filter by category and rating.",
        "2) Use Dashboard to manage bookings and profile updates.",
        "3) Use Reviews to check tutor quality before booking.",
        `Your question: "${prompt.slice(0, 180)}"`,
    ].join("\n");
};

router.post("/chat", auth(), async (req, res) => {
    try {
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

        const preferredModel = String(process.env.OPENAI_MODEL || "gpt-4.1-mini").trim();
        const fallbackModels = ["gpt-4.1-mini", "gpt-4o-mini", "gpt-4.1-nano", "gpt-3.5-turbo"];
        const modelsToTry = Array.from(new Set([preferredModel, ...fallbackModels].filter(Boolean)));
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
                            content: String(lastUserMessage.content).slice(0, 4000),
                        },
                    ],
                }),
            });

            if (!completion.ok) {
                const details = await completion.text();
                lastErrorDetails = `[model=${model}] ${details}`;
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
                reply: buildFallbackReply(String(lastUserMessage.content || "")),
                fallback: true,
            },
            warning:
                "AI provider request failed. Verify API key/model access and provider base URL configuration.",
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
