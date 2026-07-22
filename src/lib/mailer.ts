import "server-only";
import nodemailer from "nodemailer";
import { getEnabledConfig } from "./integrations";

// Sends a notification email when SMTP is enabled and configured.
// Silently no-ops otherwise so the site never depends on it.
export async function sendNotification(subject: string, html: string): Promise<boolean> {
  const cfg = await getEnabledConfig("smtp");
  if (!cfg?.host || !cfg?.user) return false;
  try {
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: parseInt(cfg.port || "587", 10),
      secure: cfg.port === "465",
      auth: { user: cfg.user, pass: cfg.pass },
    });
    await transporter.sendMail({
      from: cfg.from || cfg.user,
      to: cfg.to || cfg.user,
      subject,
      html,
    });
    return true;
  } catch {
    return false;
  }
}

export async function testSmtp(cfg: Record<string, string>): Promise<{ ok: boolean; message: string }> {
  try {
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: parseInt(cfg.port || "587", 10),
      secure: cfg.port === "465",
      auth: { user: cfg.user, pass: cfg.pass },
    });
    await transporter.verify();
    return { ok: true, message: "SMTP সংযোগ সফল হয়েছে" };
  } catch (e) {
    return { ok: false, message: `সংযোগ ব্যর্থ: ${e instanceof Error ? e.message : "unknown"}` };
  }
}
