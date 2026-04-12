import { Router } from "express";

const router = Router();

router.post("/", async (req, res) => {
    try {
        const email = String(req.body?.email || "").trim();

        if (!email) {
            return res.status(400).json({ success: false, message: "Email is required" });
        }

        const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        if (!isValidEmail) {
            return res.status(400).json({ success: false, message: "Invalid email" });
        }

        const apiKey = process.env.BREVO_API_KEY || process.env.BREVO_APIKEY;
        const listIdRaw = process.env.BREVO_LIST_ID || process.env.BREVO_NEWSLETTER_LIST_ID;
        const listId = listIdRaw ? Number(listIdRaw) : undefined;
        const senderEmail =
            process.env.BREVO_SENDER_EMAIL ||
            process.env.SENDER_EMAIL ||
            process.env.SENDER_MAIL ||
            process.env.MAIL_SENDER;
        const senderName =
            process.env.BREVO_SENDER_NAME ||
            process.env.SENDER_NAME ||
            "SkillBridge";

        if (!apiKey) {
            return res.status(500).json({ success: false, message: "Newsletter service is not configured" });
        }

        const payload: Record<string, unknown> = {
            email,
            updateEnabled: true,
        };

        if (listIdRaw && !Number.isNaN(listId)) {
            payload.listIds = [listId];
        }

        const brevoRes = await fetch("https://api.brevo.com/v3/contacts", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "api-key": apiKey,
            },
            body: JSON.stringify(payload),
        });

        if (!brevoRes.ok) {
            const details = await brevoRes.text();
            return res.status(502).json({
                success: false,
                message: "Brevo rejected the subscription",
                details,
            });
        }

        // Send welcome/confirmation email to subscribed user when sender config is present.
        if (senderEmail) {
            const mailRes = await fetch("https://api.brevo.com/v3/smtp/email", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "api-key": apiKey,
                },
                body: JSON.stringify({
                    sender: { email: senderEmail, name: senderName },
                    to: [{ email }],
                    subject: "Welcome to SkillBridge Newsletter",
                    htmlContent:
                        "<p>Hi there,</p><p>Thanks for subscribing to <strong>SkillBridge</strong> updates.</p><p>You will receive our latest offers, tutor highlights, and learning resources.</p><p>Best regards,<br/>SkillBridge Team</p>",
                    textContent:
                        "Thanks for subscribing to SkillBridge updates. You will receive our latest offers, tutor highlights, and learning resources.",
                }),
            });

            if (!mailRes.ok) {
                const mailDetails = await mailRes.text();
                return res.status(502).json({
                    success: false,
                    message: "Subscribed, but failed to send confirmation email",
                    details: mailDetails,
                });
            }
        }

        return res.status(200).json({ success: true, message: "Subscribed successfully" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to subscribe" });
    }
});

export default router;
