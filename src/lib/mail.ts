type MailpitAddress = { Email: string; Name?: string };

type MailpitSendBody = {
  From: MailpitAddress;
  To: MailpitAddress[];
  Subject: string;
  HTML: string;
  Attachments?: Array<{
    Content: string;
    Filename: string;
    ContentType: string;
  }>;
};

export type MailResult = { delivered: boolean; error?: string };

export async function deliverLocalEmail(opts: {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  pngBase64?: string;
  filename?: string;
}): Promise<MailResult> {
  const endpoint = process.env.MAILPIT_URL?.replace(/\/$/, "");
  if (!endpoint) {
    return { delivered: false, error: "MAILPIT_URL is not set; credential is in-app only." };
  }

  const body: MailpitSendBody = {
    From: {
      Email: process.env.MAIL_FROM ?? "secretariat@kautilya.local",
      Name: "Kautilya",
    },
    To: [{ Email: opts.to, Name: opts.toName }],
    Subject: opts.subject,
    HTML: opts.html,
  };
  if (opts.pngBase64) {
    body.Attachments = [
      {
        Content: opts.pngBase64,
        Filename: opts.filename ?? "kautilya-credential.png",
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
