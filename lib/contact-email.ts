const FALLBACK_CONTACT_EMAIL = "hello@webnexus.dev";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const CONTACT_EMAIL = emailPattern.test(
  process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() ?? "",
)
  ? process.env.NEXT_PUBLIC_CONTACT_EMAIL!.trim()
  : FALLBACK_CONTACT_EMAIL;
