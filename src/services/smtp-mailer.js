import nodemailer from "nodemailer";

export class SmtpMailer {
  constructor(config = {}) {
    this.config = config;
    this.transporter = null;
  }

  isConfigured() {
    return Boolean(this.config.host && this.config.from);
  }

  async send({ to, subject, text, html }) {
    if (!this.isConfigured()) throw new Error("SMTP_HOST and SMTP_FROM are required for email notifications.");
    this.transporter ??= nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: this.config.user ? { user: this.config.user, pass: this.config.password } : undefined
    });
    return await this.transporter.sendMail({ from: this.config.from, to, subject, text, html });
  }

  close() { this.transporter?.close?.(); }
}
