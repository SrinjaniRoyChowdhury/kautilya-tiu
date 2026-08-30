type BrevoAttachment = {
  content: string;
  name: string;
};

export type MailResult = { delivered: boolean; error?: string };

export type DeliverEmailOpts = {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  pngBase64?: string;
  filename?: string;
};

function sender() {
  return {
    email: process.env.MAIL_FROM ?? "noreply@technokautilya.in",
    name: process.env.MAIL_FROM_NAME ?? "Niti Sabha",
  };
}

async function deliverViaBrevo(opts: DeliverEmailOpts): Promise<MailResult> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  if (!apiKey) {
    return { delivered: false, error: "BREVO_API_KEY is not set." };
  }

  const from = sender();
  const body: Record<string, unknown> = {
    sender: { email: from.email, name: from.name },
    to: [{ email: opts.to, name: opts.toName }],
    subject: opts.subject,
    htmlContent: opts.html,
  };
  if (opts.pngBase64) {
    const attachments: BrevoAttachment[] = [
      {
        content: opts.pngBase64,
        name: opts.filename ?? "niti-sabha-credential.png",
      },
    ];
    body.attachment = attachments;
  }

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      return { delivered: false, error: text.slice(0, 400) || `Brevo ${res.status}` };
    }
    return { delivered: true };
  } catch (error) {
    return {
      delivered: false,
      error: error instanceof Error ? error.message : "Brevo unreachable",
    };
  }
}

async function deliverViaMailpit(opts: DeliverEmailOpts): Promise<MailResult> {
  const endpoint = process.env.MAILPIT_URL?.replace(/\/$/, "");
  if (!endpoint) {
    return { delivered: false, error: "MAILPIT_URL is not set; credential is in-app only." };
  }

  const from = sender();
  const body: Record<string, unknown> = {
    From: { Email: from.email, Name: from.name },
    To: [{ Email: opts.to, Name: opts.toName }],
    Subject: opts.subject,
    HTML: opts.html,
  };
  if (opts.pngBase64) {
    body.Attachments = [
      {
        Content: opts.pngBase64,
        Filename: opts.filename ?? "niti-sabha-credential.png",
        ContentType: "image/png",
      },
    ];
  }

  try {
    const res = await fetch(`${endpoint}/api/v1/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      return { delivered: false, error: text.slice(0, 400) || `Mailpit ${res.status}` };
    }
    return { delivered: true };
  } catch (error) {
    return {
      delivered: false,
      error: error instanceof Error ? error.message : "Mailpit unreachable",
    };
  }
}

/** Prefer Brevo in production; fall back to Mailpit locally. */
export async function deliverEmail(opts: DeliverEmailOpts): Promise<MailResult> {
  if (process.env.BREVO_API_KEY?.trim()) {
    return deliverViaBrevo(opts);
  }
  if (process.env.MAILPIT_URL?.trim()) {
    return deliverViaMailpit(opts);
  }
  return {
    delivered: false,
    error: "No mail provider configured (set BREVO_API_KEY or MAILPIT_URL). Credential remains in-app.",
  };
}

/** @deprecated Use deliverEmail */
export const deliverLocalEmail = deliverEmail;
