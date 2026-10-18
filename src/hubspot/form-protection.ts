import type { Severity } from "../types.ts";

export interface FormFieldHint {
  name?: string;
  label?: string;
  hidden?: boolean;
  fieldType?: string;
}

export interface FormProtectionInput {
  configuration?: { recaptchaEnabled?: boolean; honeypotEnabled?: boolean } | null;
  fieldGroups?: { fields?: FormFieldHint[] }[] | null;
}

const honeypotName = /honeypot|hp_field|bot-field|gotcha/i;

export function isHoneypotField(field: FormFieldHint): boolean {
  if ((field.fieldType ?? "").toLowerCase() === "honeypot") return true;
  if (field.hidden !== true) return false;
  return honeypotName.test(`${field.name ?? ""} ${field.label ?? ""}`);
}

/**
 * True when captcha or a honeypot is present.
 * False when both readable signals are off.
 * Null when the read cannot confirm either way.
 * HubSpot's forms definition exposes recaptchaEnabled.
 * It does not document a honeypot toggle, so a hidden honeypot field is the field signal.
 */
export function formProtection(form: FormProtectionInput): boolean | null {
  const captcha = typeof form.configuration?.recaptchaEnabled === "boolean" ? form.configuration.recaptchaEnabled : null;
  const toggle = typeof form.configuration?.honeypotEnabled === "boolean" ? form.configuration.honeypotEnabled : null;
  const fieldsKnown = Array.isArray(form.fieldGroups);
  const fields = fieldsKnown ? form.fieldGroups!.flatMap((group) => group.fields ?? []) : [];
  const fieldOn = fields.some(isHoneypotField);
  if (captcha === true || toggle === true || fieldOn) return true;
  const captchaOff = captcha === false;
  const honeypotOff = toggle === false || (toggle === null && fieldsKnown && !fieldOn);
  if (captchaOff && honeypotOff) return false;
  return null;
}

export function countRecentSubmissions(
  results: { submittedAt?: number }[],
  nowMs: number,
  windowMs = 30 * 86_400_000,
  pageLimit = 50,
): { count: number; capped: boolean } {
  const cutoff = nowMs - windowMs;
  const recent = results.filter((row) => {
    if (typeof row.submittedAt !== "number") return false;
    const at = row.submittedAt < 1_000_000_000_000 ? row.submittedAt * 1000 : row.submittedAt;
    return at >= cutoff;
  });
  const capped = results.length >= pageLimit && recent.length === results.length;
  return { count: recent.length, capped };
}

export function spamExposureRank(form: { embedded: boolean | null; recentSubmissions?: number | null }): number {
  const traffic = form.recentSubmissions;
  const hasTraffic = typeof traffic === "number" && traffic > 0;
  if (form.embedded === true && hasTraffic) return 0;
  if (form.embedded === true && (traffic === null || traffic === undefined)) return 1;
  if (form.embedded === true) return 2;
  if (form.embedded === null && hasTraffic) return 3;
  if (form.embedded === null) return 4;
  return 5;
}

export function severityForSpamRank(rank: number): Severity {
  if (rank <= 0) return "critical";
  if (rank <= 3) return "high";
  if (rank === 4) return "medium";
  return "low";
}
