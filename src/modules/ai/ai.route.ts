import { Router } from "express";
import auth from "../../middlewares/auth";

const router = Router();

router.post("/chat", auth(), async (req, res) => {
    try {
        const apiKey = String(process.env.OPENAI_API_KEY || "").trim().replace(/^['\"]|['\"]$/g, "");

        if (!apiKey) {
            return res.status(500).json({
                success: false,
                message: "AI service is not configured. Set OPENAI_API_KEY in backend environment.",
            });
        }

        const preferredModel = String(process.env.OPENAI_MODEL || "gpt-4o-mini").trim();
        const fallbackModels = ["gpt-4.1-mini", "gpt-4o-mini", "gpt-3.5-turbo"];
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

        let lastErrorDetails = "";

        for (const model of modelsToTry) {
            const completion = await fetch("https://api.openai.com/v1/chat/completions", {
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

        return res.status(502).json({
            success: false,
            message:
                "AI provider request failed. Verify OPENAI_API_KEY and model access (try OPENAI_MODEL=gpt-4.1-mini).",
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
