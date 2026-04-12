import { Router } from "express";
import auth from "../../middlewares/auth";

const router = Router();

router.post("/chat", auth(), async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: "AI service is not configured. Set OPENAI_API_KEY in backend environment.",
      });
    }

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
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

    const completion = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
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
      return res.status(502).json({
        success: false,
        message: "AI provider request failed",
        details,
      });
    }

    const data: any = await completion.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      return res.status(502).json({
        success: false,
        message: "AI response was empty",
      });
    }

    return res.status(200).json({ success: true, data: { reply } });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to generate AI response",
    });
  }
});

export default router;
