"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Check, CircleAlert, CircleCheck, Copy, LoaderCircle, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { profile } from "@/lib/portfolio-data";
import { cn } from "@/lib/utils";

type Field = "name" | "email" | "message";
type Values = Record<Field, string>;
type Errors = Partial<Record<Field, string>>;
type Status = "idle" | "sending" | "sent" | "mail-app" | "error";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate({ name, email, message }: Values): Errors {
  const errors: Errors = {};
  if (name.trim().length < 2) errors.name = "Please enter your name.";
  if (!EMAIL_PATTERN.test(email.trim())) errors.email = "Please enter a valid email address.";
  if (message.trim().length < 10) {
    errors.message = "Tell me a little more (at least 10 characters).";
  }
  return errors;
}

function readValues(form: HTMLFormElement): Values {
  const data = new FormData(form);
  return {
    name: String(data.get("name") ?? ""),
    email: String(data.get("email") ?? ""),
    message: String(data.get("message") ?? ""),
  };
}

const fieldClassName =
  "h-12 rounded-xl px-4 text-base md:text-base focus-visible:bg-white/6 transition-[color,background-color,border-color,box-shadow]";

const statusMessages: Record<Exclude<Status, "idle">, string> = {
  sending: "Sending your message…",
  sent: "Message sent. Thanks for reaching out, I'll get back to you soon.",
  "mail-app": "Your email app should open with the message ready to send.",
  error: `Something went wrong. Please try again or email me at ${profile.email}.`,
};

function FormField({
  id,
  label,
  error,
  children,
}: {
  id: Field;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      <Label
        htmlFor={id}
        className="font-mono text-xs uppercase tracking-[0.2em] text-white/70"
      >
        {label}
      </Label>
      {children}
      {error && (
        <p id={`${id}-error`} className="flex items-center gap-1.5 text-sm text-destructive">
          <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

export function ContactForm() {
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<Status>("idle");

  const fieldProps = (field: Field) => ({
    id: field,
    name: field,
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby": errors[field] ? `${field}-error` : undefined,
  });

  // Once a field has been flagged, re-check it as the visitor types.
  const handleInput = (event: FormEvent<HTMLFormElement>) => {
    const field = (event.target as HTMLInputElement).name as Field;
    if (!errors[field]) return;
    const nextError = validate(readValues(event.currentTarget))[field];
    setErrors((previous) => ({ ...previous, [field]: nextError }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = readValues(form);
    const nextErrors = validate(values);
    setErrors(nextErrors);

    const firstInvalid = (Object.keys(nextErrors) as Field[])[0];
    if (firstInvalid) {
      (form.elements.namedItem(firstInvalid) as HTMLElement | null)?.focus();
      return;
    }

    // No form backend configured: hand the message to the visitor's email app.
    if (!profile.contactFormEndpoint) {
      const subject = encodeURIComponent(`Portfolio inquiry from ${values.name.trim()}`);
      const body = encodeURIComponent(
        `${values.message.trim()}\n\n${values.name.trim()}\n${values.email.trim()}`
      );
      window.location.href = `mailto:${profile.email}?subject=${subject}&body=${body}`;
      setStatus("mail-app");
      return;
    }

    setStatus("sending");
    try {
      const response = await fetch(profile.contactFormEndpoint, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new FormData(form),
      });
      if (!response.ok) throw new Error(`Contact form failed with ${response.status}`);
      form.reset();
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  };

  const sending = status === "sending";

  return (
    <form noValidate onSubmit={handleSubmit} onInput={handleInput} className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <FormField id="name" label="Name" error={errors.name}>
          <Input
            {...fieldProps("name")}
            autoComplete="name"
            placeholder="Jane Doe"
            className={fieldClassName}
          />
        </FormField>
        <FormField id="email" label="Email" error={errors.email}>
          <Input
            {...fieldProps("email")}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="jane@company.com"
            className={fieldClassName}
          />
        </FormField>
      </div>

      <FormField id="message" label="Message" error={errors.message}>
        <Textarea
          {...fieldProps("message")}
          rows={6}
          placeholder="Tell me about your project, timeline, and goals…"
          className={cn(fieldClassName, "h-auto min-h-40 resize-y py-3.5")}
        />
      </FormField>

      {/* Glowing submit button */}
      <div className="group/submit relative pt-2">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 top-2 animate-glow-pan rounded-xl bg-[linear-gradient(90deg,var(--nebula-blue),var(--nebula-violet),var(--nebula-pink),var(--nebula-blue))] bg-size-[200%_100%] opacity-60 blur-lg transition-opacity duration-500 group-hover/submit:opacity-100 group-focus-within/submit:opacity-100"
        />
        <Button
          type="submit"
          disabled={sending}
          className="relative h-13 w-full animate-glow-pan gap-2.5 rounded-xl border-0 bg-[linear-gradient(90deg,var(--nebula-blue),var(--nebula-violet),var(--nebula-pink),var(--nebula-blue))] bg-size-[200%_100%] text-base font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] focus-visible:ring-white/60 [&_svg:not([class*='size-'])]:size-4.5"
        >
          {sending ? (
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          ) : (
            <Send aria-hidden="true" />
          )}
          {sending ? "Sending…" : "Send message"}
        </Button>
      </div>

      <p
        role="status"
        aria-live="polite"
        className={cn(
          "flex min-h-6 items-center gap-2 text-sm",
          status === "error" && "text-destructive",
          status === "sent" && "text-emerald-300",
          (status === "sending" || status === "mail-app") && "text-white/75"
        )}
      >
        {status === "sent" && <CircleCheck className="size-4 shrink-0" aria-hidden="true" />}
        {status === "error" && <CircleAlert className="size-4 shrink-0" aria-hidden="true" />}
        {status !== "idle" && statusMessages[status]}
      </p>
    </form>
  );
}

export function CopyEmailButton() {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(profile.email);
      setCopied(true);
    } catch {
      // Clipboard can be blocked (permissions, insecure context); the mailto link still works.
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label="Copy email address"
      className="grid size-11 shrink-0 place-items-center rounded-full border border-white/10 text-white/70 transition hover:border-white/25 hover:bg-white/5 hover:text-white"
    >
      {copied ? (
        <Check className="size-4 text-emerald-300" aria-hidden="true" />
      ) : (
        <Copy className="size-4" aria-hidden="true" />
      )}
      <span className="sr-only" aria-live="polite">
        {copied ? "Email address copied" : ""}
      </span>
    </button>
  );
}
