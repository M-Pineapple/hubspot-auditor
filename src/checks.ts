import { applyPropertyImpact, checkMeta, CONFIRM_NOTE, namesByImpact } from "./impact.ts";
import { severityForSpamRank, spamExposureRank } from "./hubspot/form-protection.ts";
import type { CheckRule, Finding, FormDef, PortalSnapshot, Severity, Status } from "./types.ts";

export interface CheckContext {
  snapshot: PortalSnapshot;
  rule: CheckRule;
}

export type CheckFn = (ctx: CheckContext) => Finding;

function finding(
  rule: CheckRule,
  status: Status,
  evidence: string,
  recommendedFix: string,
  severity?: Severity,
): Finding {
  const meta = checkMeta[rule.id] ?? {
    process: "data hygiene" as const,
    ownerRole: "RevOps",
    retest: "Rerun the audit after the change and confirm this check is working.",
  };
  let resolved = status;
  let resolvedEvidence = evidence;
  if (resolved === "working" && meta.confirmPass === true && rule.params.operatorConfirmed !== true) {
    resolved = "needs_operator_confirmation";
    resolvedEvidence = `${evidence}${CONFIRM_NOTE}`;
  }
  return {
    id: rule.id,
    auditor: rule.auditor,
    status: resolved,
    severity: severity ?? rule.severity,
    process: meta.process,
    title: rule.title,
    evidence: resolvedEvidence,
    recommendedFix,
    ownerRole: meta.ownerRole,
    retest: meta.retest,
  };
}

function blockedFinding(rule: CheckRule, snapshot: PortalSnapshot, area: string, scopeFix: string): Finding | null {
  const hit = snapshot.fetchGaps.find((item) => item.area === area);
  if (!hit) return null;
  if (hit.status === 0) {
    return finding(
      rule,
      "missing",
      `Could not reach the host for ${area} (${hit.path}). No HTTP response came back.`,
      "Check DNS for api.hubapi.com and run the audit again.",
    );
  }
  if (hit.status === 200) {
    return finding(
      rule,
      "missing",
      `${area} was returned but is not mapped into the snapshot yet (${hit.path}).`,
      "Extend the loader for this response, or turn the check off.",
    );
  }
  if (hit.status === 429 || hit.status >= 500) {
    return finding(
      rule,
      "missing",
      `Could not read ${area} (${hit.path}, HTTP ${hit.status}) after retries.`,
      "Run the audit again. This was throttling or a HubSpot outage, not a missing scope.",
    );
  }
  if (hit.status === 401 || hit.status === 403) {
    return finding(rule, "missing", `Could not read ${area} (${hit.path}, HTTP ${hit.status}).`, scopeFix);
  }
  return finding(
    rule,
    "missing",
    `Could not read ${area} (${hit.path}, HTTP ${hit.status}).`,
    "Confirm this read endpoint exists for the portal, then run the audit again.",
  );
}

export function sanitizePortalName(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f<>`]/g, "").trim().slice(0, 40);
}

export function portalNameList(names: string[], limit = 5): string {
  const clean = names.map(sanitizePortalName).filter((name) => name.length > 0);
  const shown = clean.slice(0, limit);
  const extra = clean.length - shown.length;
  return extra > 0 ? `${shown.join(", ")} and ${extra} more` : shown.join(", ");
}

function compareSpamForms(left: FormDef, right: FormDef): number {
  return spamExposureRank(left) - spamExposureRank(right) || left.name.localeCompare(right.name);
}

function describeSpamForm(form: FormDef): string {
  const name = sanitizePortalName(form.name) || "unnamed form";
  const place = form.embedded === true ? "on a public page" : form.embedded === false ? "not embedded" : "embed status unknown";
  let traffic = "submission count was not returned";
  if (typeof form.recentSubmissions === "number") {
    traffic = form.submissionsCapped === true
      ? `at least ${form.recentSubmissions} submissions in 30 days`
      : `${form.recentSubmissions} submissions in 30 days`;
  }
  return `${name} (${place}, ${traffic})`;
}

function spamList(forms: FormDef[]): string {
  return forms.map(describeSpamForm).join("; ");
}

function num(params: Record<string, unknown>, key: string, fallback: number): number {
  const value = params[key];
  return typeof value === "number" ? value : fallback;
}

function strList(params: Record<string, unknown>, key: string): string[] {
  const value = params[key];
  return Array.isArray(value) ? value.map(String) : [];
}

export const checks: Record<string, CheckFn> = {
  "crm.duplicate-contacts": ({ snapshot, rule }) => {
    const blocked = blockedFinding(rule, snapshot, "contacts", "Grant the read scope for contacts and run the audit again.");
    if (blocked) return blocked;
    const counts = new Map<string, number>();
    for (const contact of snapshot.contacts) {
      const email = contact.email?.trim().toLowerCase();
      if (!email) continue;
      counts.set(email, (counts.get(email) ?? 0) + 1);
    }
    const duplicateGroups = [...counts.values()].filter((count) => count >= num(rule.params, "minGroupSize", 2)).length;
    if (duplicateGroups === 0) {
      return finding(rule, "working", "No duplicate email addresses in the contact sample.", "Keep a unique email property and a merge workflow.");
    }
    return finding(
      rule,
      "broken",
      `${duplicateGroups} email address(es) are shared by more than one contact.`,
      "Merge the duplicate contacts and turn on a create-time duplicate rule.",
    );
  },

  "crm.duplicate-companies": ({ snapshot, rule }) => {
    const blocked = blockedFinding(rule, snapshot, "companies", "Grant the read scope for companies and run the audit again.");
    if (blocked) return blocked;
    const counts = new Map<string, number>();
    for (const company of snapshot.companies) {
      const domain = company.domain?.trim().toLowerCase();
      if (!domain) continue;
      counts.set(domain, (counts.get(domain) ?? 0) + 1);
    }
    const duplicateGroups = [...counts.values()].filter((count) => count >= 2).length;
    if (duplicateGroups === 0) {
      return finding(rule, "working", "No duplicate company domains in the sample.", "Keep domain as the company unique key.");
    }
    return finding(
      rule,
      "broken",
      `${duplicateGroups} domain(s) are shared by more than one company.`,
      "Merge companies that share a domain.",
    );
  },

  "crm.missing-required-properties": ({ snapshot, rule }) => {
    const blocked = blockedFinding(rule, snapshot, "properties", "Grant the read scope for properties and run the audit again.");
    if (blocked) return blocked;
    const required = new Set(strList(rule.params, "names"));
    if (required.size === 0) {
      for (const property of snapshot.properties) if (property.required) required.add(property.name);
    }
    const judged = snapshot.properties.filter(
      (property) => required.has(property.name) && property.filledCount !== null && property.totalCount > 0,
    );
    const assessed = new Set(judged.map((property) => property.name));
    const unassessed = [...required].filter((name) => !assessed.has(name));
    const coverageNote = unassessed.length > 0
      ? ` Required properties could not be assessed: ${portalNameList(unassessed)}.`
      : "";
    const readFix = "Request those properties on the contact read and run the audit again.";
    const thin = judged.filter((property) => (property.filledCount ?? 0) / property.totalCount < num(rule.params, "minFillRatio", 0.9));
    if (judged.length === 0 || (thin.length === 0 && unassessed.length > 0)) {
      return finding(rule, "missing", `Required-property coverage is incomplete.${coverageNote}`, readFix);
    }
    if (thin.length === 0) {
      return finding(rule, "working", "Required properties are filled on at least 90% of records.", "Keep required fields on create forms.");
    }
    const ordered = namesByImpact(thin.map((item) => item.name));
    return applyPropertyImpact(
      finding(
        rule,
        "broken",
        `${thin.length} required property name(s) are below the fill ratio: ${portalNameList(ordered)}.${coverageNote}`,
        `Make the thin properties required on the create forms and backfill the blanks.${unassessed.length > 0 ? ` ${readFix}` : ""}`,
      ),
      ordered,
    );
  },

  "crm.unused-custom-properties": ({ snapshot, rule }) => {
    const blocked = blockedFinding(rule, snapshot, "properties", "Grant the read scope for properties and run the audit again.");
    if (blocked) return blocked;
    const sampled = snapshot.properties.filter(
      (property) => property.custom && property.filledCount !== null && property.totalCount > 0,
    );
    if (sampled.length === 0) {
      return finding(
        rule,
        "missing",
        "No custom properties had sampled contact values, so usage could not be assessed.",
        "Request custom properties on the contact read and sample contacts before judging usage.",
      );
    }
    const unused = sampled.filter((property) => (property.filledCount ?? 0) <= num(rule.params, "maxFilled", 0));
    if (unused.length === 0) {
      return finding(rule, "working", "Every custom property in the sample has at least one value.", "Review new properties after 30 days.");
    }
    const ordered = namesByImpact(unused.map((item) => item.name));
    return applyPropertyImpact(
      finding(
        rule,
        "missing",
        `${unused.length} custom property name(s) have no values: ${portalNameList(ordered)}.`,
        "Archive unused properties or start collecting them on a form.",
      ),
      ordered,
    );
  },

  "crm.lifecycle-lead-status": ({ snapshot, rule }) => {
    const blocked = blockedFinding(rule, snapshot, "contacts", "Grant the read scope for contacts and run the audit again.");
    if (blocked) return blocked;
    const badPairs = strList(rule.params, "conflicts");
    let mismatches = 0;
    for (const contact of snapshot.contacts) {
      const pair = `${contact.lifecycleStage ?? ""}|${contact.leadStatus ?? ""}`;
      if (badPairs.includes(pair)) mismatches += 1;
    }
    if (mismatches === 0) {
      return finding(rule, "working", "Lifecycle stage and lead status do not use a conflicting pair.", "Document the allowed pairs for your team.");
    }
    return finding(
      rule,
      "broken",
      `${mismatches} contact(s) use a conflicting lifecycle stage and lead status.`,
      "Clear the conflicting lead status when lifecycle stage changes.",
    );
  },

  "pipelines.stage-probabilities": ({ snapshot, rule }) => {
    const blocked = blockedFinding(rule, snapshot, "pipelines-deals", "Grant the read scope for deal pipelines and run the audit again.");
    if (blocked) return blocked;
    const floor = num(rule.params, "lateStageMinProbability", 40);
    const dealPipelines = snapshot.pipelines.filter((item) => item.objectType === "deals");
    if (dealPipelines.length === 0) {
      return finding(rule, "missing", "No deal pipeline was returned.", "Create a deal pipeline before judging stage probabilities.");
    }
    const weak: string[] = [];
    for (const pipeline of snapshot.pipelines.filter((item) => item.objectType === "deals")) {
      pipeline.stages.forEach((stage, index) => {
        if (index === 0) return;
        if (stage.probability === null || stage.probability < floor) weak.push(stage.label);
      });
    }
    if (weak.length === 0) {
      return finding(rule, "working", "Later deal stages have a probability at or above the floor.", "Review probabilities when you add a stage.");
    }
    return finding(
      rule,
      "broken",
      `${weak.length} later deal stage(s) are below ${floor}% probability.`,
      "Set a realistic probability on each open stage.",
    );
  },

  "pipelines.stale-deals": ({ snapshot, rule }) => {
    const blocked = blockedFinding(rule, snapshot, "deals", "Grant the read scope for deals and run the audit again.");
    if (blocked) return blocked;
    if (snapshot.deals.length === 0) {
      return finding(rule, "missing", "No deals were sampled.", "Read the deals object before judging staleness.");
    }
    const days = num(rule.params, "staleDays", 30);
    const stale = snapshot.deals.filter((deal) => deal.daysSinceUpdate >= days);
    if (stale.length === 0) {
      return finding(rule, "working", `No sampled deal has been quiet for ${days} days or more.`, "Add a stale-deal task workflow.");
    }
    return finding(
      rule,
      "broken",
      `${stale.length} sampled deal(s) have not been updated for ${days} days or more.`,
      "Create a workflow that tasks the owner when a deal goes stale.",
    );
  },

  "pipelines.required-fields": ({ snapshot, rule }) => {
    const blocked = blockedFinding(rule, snapshot, "pipelines-deals", "Grant the read scope for deal pipelines and run the audit again.");
    if (blocked) return blocked;
    const expected = strList(rule.params, "properties");
    const deals = snapshot.pipelines.filter((pipeline) => pipeline.objectType === "deals");
    if (deals.some((pipeline) => pipeline.requirementsKnown === false)) {
      return finding(
        rule,
        "missing",
        "The pipeline read does not include required properties for each stage.",
        "HubSpot did not return those rules on the pipeline payload, so this audit cannot score them.",
      );
    }
    const missingNames: string[] = [];
    for (const pipeline of deals) {
      for (const stage of pipeline.stages) {
        for (const name of expected) {
          if (!stage.requiredProperties.includes(name) && !missingNames.includes(name)) missingNames.push(name);
        }
      }
    }
    const ordered = namesByImpact(missingNames);
    const bare = deals.filter((pipeline) => pipeline.stages.some((stage) => expected.some((name) => !stage.requiredProperties.includes(name))));
    if (bare.length === 0) {
      return finding(rule, "working", "Every stage requires the configured fields.", "Keep the required list in this YAML file.");
    }
    return applyPropertyImpact(
      finding(
        rule,
        "missing",
        `${bare.length} pipeline(s) have a stage that does not require the configured fields: ${portalNameList(ordered)}.`,
        "Mark those properties required before a record can enter the stage.",
      ),
      ordered,
    );
  },

  "pipelines.stage-automation": ({ snapshot, rule }) => {
    const blocked = blockedFinding(rule, snapshot, "pipelines-deals", "Grant the read scope for deal pipelines and run the audit again.");
    if (blocked) return blocked;
    const deals = snapshot.pipelines.filter((pipeline) => pipeline.objectType === "deals");
    if (deals.length === 0) {
      return finding(rule, "missing", "No deal pipeline was returned.", "Create a deal pipeline before judging stage automation.");
    }
    if (deals.some((pipeline) => pipeline.automationKnown === false)) {
      return finding(rule, "missing", "Stage-change actions were not in the pipeline read.", "Read workflow enrolment before judging stage automation.");
    }
    const quiet = deals.filter((pipeline) => pipeline.automatedStageIds.length === 0);
    if (quiet.length === 0) {
      return finding(rule, "working", "Every pipeline has at least one stage automation.", "Review the automation when stages change.");
    }
    return finding(
      rule,
      "missing",
      `${quiet.length} pipeline(s) have no stage-change automation.`,
      "Add a workflow or stage action for the first handoff stage.",
    );
  },

  "pipelines.ticket-pipeline": ({ snapshot, rule }) => {
    const blocked = blockedFinding(rule, snapshot, "pipelines-tickets", "Grant the read scope for ticket pipelines and run the audit again.");
    if (blocked) return blocked;
    const tickets = snapshot.pipelines.filter((pipeline) => pipeline.objectType === "tickets");
    if (tickets.length > 0) {
      return finding(rule, "working", `${tickets.length} ticket pipeline(s) are defined.`, "Keep a closed stage and a required resolution field.");
    }
    return finding(rule, "missing", "No ticket pipeline was returned.", "Create a support pipeline if you handle tickets in HubSpot.");
  },

  "forms.live-forms": ({ snapshot, rule }) => {
    const blocked = blockedFinding(rule, snapshot, "forms", "Grant the read scope for forms and run the audit again.");
    if (blocked) return blocked;
    const live = snapshot.forms.filter((form) => !form.archived);
    if (live.length > 0) {
      return finding(rule, "working", `${live.length} form(s) are not archived.`, "Archive forms that no page still embeds.");
    }
    return finding(rule, "missing", "Every form is archived.", "Publish one form for the primary conversion.");
  },

  "forms.unused-forms": ({ snapshot, rule }) => {
    const blocked = blockedFinding(rule, snapshot, "forms", "Grant the read scope for forms and run the audit again.");
    if (blocked) return blocked;
    if (snapshot.forms.some((form) => !form.archived && form.embedded === null)) {
      return finding(rule, "missing", "Embed status was not in the read response.", "Pass a public site URL or extend the loader with embed evidence.");
    }
    const unused = snapshot.forms.filter((form) => !form.archived && form.embedded === false);
    if (unused.length === 0) {
      return finding(rule, "working", "Every live form is marked embedded.", "Re-check embeds when a landing page is retired.");
    }
    return finding(
      rule,
      "missing",
      `${unused.length} live form(s) are not embedded.`,
      "Embed the form or archive it.",
    );
  },

  "forms.field-mapping": ({ snapshot, rule }) => {
    const blocked = blockedFinding(rule, snapshot, "forms", "Grant the read scope for forms and run the audit again.");
    if (blocked) return blocked;
    if (snapshot.forms.some((form) => form.unmappedFields === null)) {
      return finding(rule, "missing", "Field mapping was not in the read response.", "Read each form definition before judging mappings.");
    }
    const unmapped = snapshot.forms.reduce((sum, form) => sum + (form.unmappedFields ?? 0), 0);
    if (unmapped === 0) {
      return finding(rule, "working", "Form fields map to properties.", "Map any new field before you publish.");
    }
    return finding(
      rule,
      "broken",
      `${unmapped} form field(s) have no property mapping.`,
      "Map each field to a contact or company property.",
    );
  },

  "forms.gdpr-consent": ({ snapshot, rule }) => {
    const blocked = blockedFinding(rule, snapshot, "forms", "Grant the read scope for forms and run the audit again.");
    if (blocked) return blocked;
    if (snapshot.forms.some((form) => !form.archived && form.gdprConsent === null)) {
      return finding(rule, "missing", "GDPR consent was not in the read response.", "Read legal consent options on each live form.");
    }
    const bare = snapshot.forms.filter((form) => !form.archived && form.gdprConsent === false);
    if (bare.length === 0) {
      return finding(rule, "working", "Live forms include a GDPR consent field.", "Keep the consent text dated and specific.");
    }
    return finding(
      rule,
      "broken",
      `${bare.length} live form(s) have no GDPR consent field.`,
      "Add a consent checkbox and store the lawful basis.",
    );
  },

  "forms.follow-up-email": ({ snapshot, rule }) => {
    const blocked = blockedFinding(rule, snapshot, "forms", "Grant the read scope for forms and run the audit again.");
    if (blocked) return blocked;
    const live = snapshot.forms.filter((form) => !form.archived);
    if (live.length === 0 || live.every((form) => form.embedded === false)) {
      return finding(rule, "missing", "No embedded live form was available to judge follow-up email.", "Embed a form, or record which forms are embedded.");
    }
    if (live.some((form) => form.embedded === null || (form.embedded === true && form.followUpEmail === null))) {
      return finding(rule, "missing", "Follow-up email status was not in the read response.", "Read the form follow-up or the submit workflow.");
    }
    const quiet = snapshot.forms.filter((form) => !form.archived && form.embedded === true && form.followUpEmail === false);
    if (quiet.length === 0) {
      return finding(rule, "working", "Embedded forms have a follow-up email.", "Send a plain confirmation, not only an internal alert.");
    }
    return finding(
      rule,
      "missing",
      `${quiet.length} embedded form(s) have no follow-up email.`,
      "Add a follow-up email or a workflow enrolment on submit.",
    );
  },

  "forms.spam-protection": ({ snapshot, rule }) => {
    const blocked = blockedFinding(rule, snapshot, "forms", "Grant the read scope for forms and run the audit again.");
    if (blocked) return blocked;
    const live = snapshot.forms.filter((form) => !form.archived);
    if (live.length === 0) {
      return finding(rule, "missing", "No live form was returned.", "Publish one form before judging spam protection.");
    }
    const open = [...live.filter((form) => form.spamProtection === false)].sort(compareSpamForms);
    const unknown = [...live.filter((form) => form.spamProtection === null)].sort(compareSpamForms);
    const fix = "Turn on captcha or add a honeypot field.";
    if (open.length === 0 && unknown.length === 0) {
      return finding(rule, "working", "Live forms have captcha or a honeypot field.", "Keep captcha or a honeypot on public forms.");
    }
    if (open.length === 0) {
      const worst = severityForSpamRank(spamExposureRank(unknown[0]));
      return finding(
        rule,
        "needs_operator_confirmation",
        `${unknown.length} live form(s) could not be confirmed from the forms API: ${spamList(unknown)}. Captcha or a honeypot field was not in the read, so this is not a pass.`,
        fix,
        worst,
      );
    }
    const worst = severityForSpamRank(spamExposureRank(open[0]));
    const unknownNote = unknown.length > 0 ? ` ${unknown.length} other live form(s) still need operator confirmation: ${spamList(unknown)}.` : "";
    return finding(
      rule,
      "broken",
      `${open.length} live form(s) have no captcha and no honeypot field: ${spamList(open)}.${unknownNote} The forms API does not return HubSpot's honeypot toggle, so confirm that setting in the form editor if you use it.`,
      fix,
      worst,
    );
  },

  "tracking.install-code": ({ snapshot, rule }) => {
    const html = snapshot.tracking.html;
    if (snapshot.tracking.fetchError) {
      return finding(rule, "missing", snapshot.tracking.fetchError, "Publish a public URL and fetch it again.");
    }
    if (!html) {
      return finding(rule, "missing", "No public page was fetched.", "Set a public site URL and run the audit again.");
    }
    const present = html.includes("js.hs-scripts.com") || html.includes("hs-script-loader");
    if (present) {
      return finding(rule, "working", "The public page includes the HubSpot tracking script.", "Keep the script in the shared layout.");
    }
    return finding(
      rule,
      "broken",
      "The public page HTML does not include the HubSpot tracking script.",
      "Add the portal tracking code to the site layout.",
    );
  },

  "tracking.cookie-banner": ({ snapshot, rule }) => {
    if (!snapshot.tracking.html) {
      return finding(rule, "missing", "No public page was fetched.", "Fetch the public URL before judging the banner.");
    }
    if (snapshot.tracking.cookieBanner) {
      return finding(rule, "working", "The public page marks a cookie or consent banner.", "Confirm the banner blocks non-essential cookies until consent.");
    }
    return finding(
      rule,
      "broken",
      "The public page does not show a known cookie-banner marker.",
      "Add a consent banner before non-essential HubSpot cookies load.",
    );
  },

  "tracking.utm-capture": ({ snapshot, rule }) => {
    if (snapshot.tracking.utmTotal === 0) {
      return finding(rule, "missing", "No UTM properties were in the snapshot.", "Create utm_source, utm_medium, and utm_campaign properties.");
    }
    const ratio = snapshot.tracking.utmFilled / snapshot.tracking.utmTotal;
    if (ratio >= num(rule.params, "minFillRatio", 0.5)) {
      return finding(rule, "working", "UTM properties are filled on at least half of the sampled values.", "Keep hidden fields on campaign forms.");
    }
    return finding(
      rule,
      "missing",
      "UTM properties exist but most sampled values are empty.",
      "Pass UTM parameters into hidden form fields.",
    );
  },

  "tracking.original-source": ({ snapshot, rule }) => {
    if (snapshot.tracking.contactCount === 0) {
      return finding(rule, "missing", "No contacts were sampled for original source.", "Sample contacts with hs_analytics_source.");
    }
    const ratio = snapshot.tracking.originalSourceFilled / snapshot.tracking.contactCount;
    if (ratio >= num(rule.params, "minFillRatio", 0.8)) {
      return finding(rule, "working", "Original source is filled on most sampled contacts.", "Do not overwrite original source on later form fills.");
    }
    return finding(
      rule,
      "broken",
      "Original source is missing on too many sampled contacts.",
      "Stop blank imports from clearing original source.",
    );
  },

  "email.workflows-health": ({ snapshot, rule }) => {
    const blocked = blockedFinding(rule, snapshot, "workflows", "Grant the automation read scope and run the audit again.");
    if (blocked) return blocked;
    const flows = snapshot.workflows.filter((workflow) => workflow.kind === "workflow");
    if (flows.length === 0) {
      return finding(rule, "missing", "No workflows were returned.", "Create the operational workflows you expect, or confirm the automation scope.");
    }
    if (flows.some((workflow) => workflow.errored === null || workflow.enrolmentCount === null)) {
      return finding(
        rule,
        "missing",
        "Workflow error or enrolment counts were not in the read response.",
        "Read flow errors and enrolment totals, then run the audit again.",
      );
    }
    const errored = flows.filter((workflow) => workflow.errored === true);
    const idle = flows.filter((workflow) => workflow.enabled && workflow.errored === false && workflow.enrolmentCount === 0);
    if (errored.length === 0 && idle.length === 0 && flows.some((workflow) => workflow.enabled)) {
      return finding(rule, "working", "Active workflows have enrolments and none are errored.", "Review error notifications monthly.");
    }
    if (errored.length > 0) {
      return finding(
        rule,
        "broken",
        `${errored.length} workflow(s) are in error. ${idle.length} active workflow(s) have no enrolment.`,
        "Open the errored workflows and fix the failing action.",
      );
    }
    return finding(
      rule,
      "broken",
      `${idle.length} active workflow(s) have no enrolment.`,
      "Fix the enrolment trigger or turn the workflow off.",
    );
  },

  "email.nurture-sequence": ({ snapshot, rule }) => {
    const blocked = blockedFinding(rule, snapshot, "workflows", "Grant the automation read scope and run the audit again.");
    if (blocked) return blocked;
    const nurture = snapshot.workflows.filter((workflow) => workflow.kind === "nurture" && workflow.enabled);
    if (nurture.length > 0) {
      return finding(rule, "working", `${nurture.length} nurture sequence(s) are active.`, "Suppress nurtures when a contact becomes a customer.");
    }
    return finding(rule, "missing", "No active nurture sequence was found.", "Add one short nurture for new leads.");
  },

  "email.unengaged-handling": ({ snapshot, rule }) => {
    const blocked = blockedFinding(rule, snapshot, "workflows", "Grant the automation read scope and run the audit again.");
    if (blocked) return blocked;
    const handler = snapshot.workflows.filter((workflow) => workflow.kind === "unengaged" && workflow.enabled);
    if (handler.length > 0) {
      return finding(rule, "working", "An active workflow handles unengaged contacts.", "Suppress or delete contacts who never engage.");
    }
    return finding(rule, "missing", "No workflow handles unengaged contacts.", "Add a sunset workflow after a set number of unopened emails.");
  },

  "email.sender-authentication": ({ snapshot, rule }) => {
    const blocked = blockedFinding(rule, snapshot, "senders", "Read sender-domain authentication and run the audit again.");
    if (blocked) return blocked;
    if (snapshot.senderDomains.length === 0) {
      return finding(rule, "missing", "No sender domain was returned.", "Connect the domain you send from.");
    }
    const weak = snapshot.senderDomains.filter(
      (domain) => domain.spf !== "pass" || domain.dkim !== "pass" || domain.dmarc !== "pass",
    );
    if (weak.length === 0) {
      return finding(rule, "working", "SPF, DKIM, and DMARC pass for every sender domain.", "Keep DMARC at quarantine or reject.");
    }
    return finding(
      rule,
      "broken",
      `${weak.length} sender domain(s) are missing a pass on SPF, DKIM, or DMARC.`,
      "Publish the missing DNS records before the next campaign.",
    );
  },

  "integrations.connected-apps": ({ snapshot, rule }) => {
    const blocked = blockedFinding(rule, snapshot, "integrations", "Grant the integrations read scope and run the audit again.");
    if (blocked) return blocked;
    const connected = snapshot.integrations.filter((item) => item.connected);
    if (connected.length > 0) {
      return finding(rule, "working", `${connected.length} app(s) are connected.`, "Remove apps you no longer use.");
    }
    return finding(rule, "missing", "No connected app was returned.", "Connect the CRM tools you rely on, or ignore this if you use HubSpot alone.");
  },

  "integrations.webhook-subscriptions": ({ snapshot, rule }) => {
    const blocked = blockedFinding(rule, snapshot, "webhooks", "Grant the webhooks read scope and run the audit again.");
    if (blocked) return blocked;
    if (snapshot.webhooks.length === 0) {
      return finding(rule, "missing", "No webhook subscription was returned.", "Subscribe to the events your integration needs.");
    }
    const inactive = snapshot.webhooks.filter((hook) => !hook.active);
    if (inactive.length === 0) {
      return finding(rule, "working", "Every webhook subscription is active.", "Alert on a rising error count.");
    }
    return finding(
      rule,
      "broken",
      `${inactive.length} webhook subscription(s) are inactive.`,
      "Repair or remove the inactive subscription.",
    );
  },

  "integrations.sync-errors": ({ snapshot, rule }) => {
    const blocked = blockedFinding(rule, snapshot, "integrations", "Grant the integrations read scope and run the audit again.");
    if (blocked) return blocked;
    const badApps = snapshot.integrations.filter((item) => item.syncError);
    const badHooks = snapshot.webhooks.filter((hook) => hook.errorCount > 0);
    if (badApps.length === 0 && badHooks.length === 0) {
      return finding(rule, "working", "No sync error was flagged on apps or webhooks.", "Check this after each integration change.");
    }
    return finding(
      rule,
      "broken",
      `${badApps.length} app(s) and ${badHooks.length} webhook(s) report sync errors.`,
      "Open the failing sync and replay or pause it.",
    );
  },

  "reporting.dashboards": ({ snapshot, rule }) => {
    const blocked = blockedFinding(rule, snapshot, "reports", "Grant the reporting read scope and run the audit again.");
    if (blocked) return blocked;
    const dashboards = snapshot.reports.filter((report) => report.kind === "dashboard");
    if (dashboards.length > 0) {
      return finding(rule, "working", `${dashboards.length} dashboard(s) are present.`, "Keep one operating dashboard for the revenue team.");
    }
    return finding(rule, "missing", "No dashboard was returned.", "Create one dashboard for pipeline and lifecycle.");
  },

  "reporting.attribution": ({ snapshot, rule }) => {
    const blocked = blockedFinding(rule, snapshot, "reports", "Grant the reporting read scope and run the audit again.");
    if (blocked) return blocked;
    const reports = snapshot.reports.filter((report) => report.kind === "attribution");
    if (reports.length > 0) {
      return finding(rule, "working", `${reports.length} attribution report(s) are present.`, "Review the model when campaigns change.");
    }
    return finding(rule, "missing", "No attribution report was returned.", "Add an attribution report for paid and organic channels.");
  },

  "reporting.lifecycle-funnel": ({ snapshot, rule }) => {
    const stages = new Set(snapshot.contacts.map((contact) => contact.lifecycleStage?.trim()).filter((stage) => stage));
    if (stages.size >= 2) {
      return finding(rule, "working", `The contact sample spans ${stages.size} lifecycle stages.`, "Use the same stage names on the funnel report.");
    }
    const reports = snapshot.reports.filter((report) => report.kind === "lifecycle-funnel");
    if (reports.length > 0) {
      return finding(rule, "working", `${reports.length} lifecycle funnel report(s) are present.`, "Use the same stage names as the CRM properties.");
    }
    const blocked = blockedFinding(rule, snapshot, "reports", "Grant the reporting read scope and run the audit again.");
    if (blocked && stages.size === 0) return blocked;
    if (stages.size === 1) {
      return finding(rule, "missing", "Sampled contacts use only one lifecycle stage.", "Move contacts through the stages so a funnel can be read.");
    }
    return finding(rule, "missing", "No lifecycle funnel report was returned.", "Build a funnel from subscriber to customer.");
  },

  "brand.published-pages": ({ snapshot, rule }) => {
    const blocked = blockedFinding(rule, snapshot, "landing-pages", "Grant the CMS read scope and run the audit again.");
    if (blocked) return blocked;
    const published = snapshot.landingPages.filter((page) => page.published);
    if (published.length > 0) {
      return finding(rule, "working", `${published.length} landing page(s) are published.`, "Keep a draft only while it is still being edited.");
    }
    return finding(rule, "missing", "No published landing page was returned.", "Publish the page for the primary campaign.");
  },

  "brand.page-meta": ({ snapshot, rule }) => {
    const blocked = blockedFinding(rule, snapshot, "landing-pages", "Grant the CMS read scope and run the audit again.");
    if (blocked) return blocked;
    const published = snapshot.landingPages.filter((page) => page.published);
    if (published.length === 0) {
      return finding(rule, "missing", "No published landing page was available for meta checks.", "Publish a page before judging titles and descriptions.");
    }
    const thin = published.filter((page) => !page.metaTitle?.trim() || !page.metaDescription?.trim());
    if (thin.length === 0) {
      return finding(rule, "working", "Published landing pages have a title and a meta description.", "Keep the description specific to the offer.");
    }
    return finding(rule, "broken", `${thin.length} published landing page(s) are missing a title or meta description.`, "Fill the HTML title and meta description before the next campaign.");
  },

  "brand.page-tracking": ({ snapshot, rule }) => {
    const blocked = blockedFinding(rule, snapshot, "landing-pages", "Grant the CMS read scope and run the audit again.");
    if (blocked) return blocked;
    const published = snapshot.landingPages.filter((page) => page.published);
    const withHtml = published.filter((page) => page.html !== null);
    if (withHtml.length === 0) {
      return finding(rule, "missing", "Published landing page HTML was not fetched.", "Fetch each published page URL and run the audit again.");
    }
    const bare = withHtml.filter((page) => !page.html?.includes("js.hs-scripts.com") && !page.html?.includes("hs-script-loader"));
    if (bare.length === 0) {
      return finding(rule, "working", "Published landing pages include the tracking script.", "Keep the script in the page template.");
    }
    return finding(rule, "broken", `${bare.length} published landing page(s) have no tracking script.`, "Add the portal tracking code to the landing page template.");
  },

  "brand.page-cta": ({ snapshot, rule }) => {
    const blocked = blockedFinding(rule, snapshot, "landing-pages", "Grant the CMS read scope and run the audit again.");
    if (blocked) return blocked;
    const patterns = strList(rule.params, "patterns");
    const needles = patterns.length > 0 ? patterns : ["hs-cta", "hs-form"];
    const published = snapshot.landingPages.filter((page) => page.published);
    const withHtml = published.filter((page) => page.html !== null);
    if (withHtml.length === 0) {
      return finding(rule, "missing", "Published landing page HTML was not fetched.", "Fetch each published page URL before judging calls to action.");
    }
    const quiet = withHtml.filter((page) => !needles.some((needle) => page.html?.includes(needle)));
    if (quiet.length === 0) {
      return finding(rule, "working", "Published landing pages include a call to action.", "Point the action at one form or one meeting link.");
    }
    return finding(rule, "broken", `${quiet.length} published landing page(s) have no call to action.`, "Add a form, a button, or a HubSpot CTA.");
  },

  "brand.markers": ({ snapshot, rule }) => {
    const markers = strList(rule.params, "markers");
    if (markers.length === 0) {
      return finding(
        rule,
        "working",
        "No extra phrases are configured. Logo, favicon, heading, and colour checks still run.",
        "Add params.markers only for words that must appear verbatim.",
      );
    }
    const blocked = blockedFinding(rule, snapshot, "landing-pages", "Grant the CMS read scope and run the audit again.");
    if (blocked) return blocked;
    const published = snapshot.landingPages.filter((page) => page.published);
    const withHtml = published.filter((page) => page.html !== null);
    if (withHtml.length === 0) {
      return finding(rule, "missing", "Published landing page HTML was not fetched.", "Fetch the page HTML before comparing it with the brand markers.");
    }
    const drift = withHtml.filter((page) => markers.some((marker) => !page.html?.includes(marker)));
    if (drift.length === 0) {
      return finding(rule, "working", "Published landing pages include the configured brand markers.", "Update the marker list when the brand system changes.");
    }
    return finding(rule, "broken", `${drift.length} published landing page(s) are missing a configured brand marker.`, "Apply the shared template instead of a one-off page style.");
  },

  "journey.stage-hooks": ({ snapshot, rule }) => {
    const blocked = blockedFinding(rule, snapshot, "emails", "Grant the marketing email read scope and run the audit again.");
    if (blocked) return blocked;
    const stages = Array.isArray(rule.params.stages) ? rule.params.stages : [];
    const parsed = stages.flatMap((stage) => {
      if (!stage || typeof stage !== "object") return [];
      const record = stage as { stage?: string; patterns?: string[] };
      const name = String(record.stage ?? "");
      const patterns = Array.isArray(record.patterns) ? record.patterns.map(String) : [];
      return name ? [{ name, patterns }] : [];
    });
    if (parsed.length === 0) {
      return finding(rule, "missing", "No buyer-journey stages are configured.", "List lifecycle stages and email name patterns in the YAML.");
    }
    const published = snapshot.emails.filter((email) => email.published);
    const uncovered = parsed.filter((stage) => {
      const corpus = [
        ...published.map((email) => `${email.name} ${email.subject ?? ""}`),
        ...snapshot.workflows.filter((workflow) => workflow.enabled).map((workflow) => workflow.name),
      ].join("\n").toLowerCase();
      return !stage.patterns.some((pattern) => corpus.includes(pattern.toLowerCase()));
    });
    if (uncovered.length === 0) {
      return finding(rule, "working", "Each configured journey stage has a published email or an active workflow.", "Suppress later-stage mail when a contact moves backward.");
    }
    return finding(
      rule,
      "broken",
      `${uncovered.length} journey stage(s) have no matching published email: ${portalNameList(uncovered.map((stage) => stage.name))}.`,
      "Add one email or workflow for each uncovered stage.",
    );
  },

  "program.dynamic-lists": ({ snapshot, rule }) => {
    const blocked = blockedFinding(rule, snapshot, "lists", "Grant the lists read scope and run the audit again.");
    if (blocked) return blocked;
    const dynamic = snapshot.lists.filter((list) => list.dynamic);
    if (dynamic.length > 0) {
      return finding(rule, "working", `${dynamic.length} active list(s) are dynamic.`, "Use a dynamic list for each lifecycle stage you mail.");
    }
    return finding(rule, "missing", "No dynamic list was returned.", "Build dynamic lists for the stages you email.");
  },

  "program.lead-score": ({ snapshot, rule }) => {
    const blocked = blockedFinding(rule, snapshot, "properties", "Grant the read scope for properties and run the audit again.");
    if (blocked) return blocked;
    const names = strList(rule.params, "names");
    const wanted = names.length > 0 ? names : ["hs_predictivecontactscore"];
    const found = snapshot.properties.filter((property) => wanted.includes(property.name));
    if (found.length === 0) {
      return finding(rule, "missing", "No lead-score property was returned.", "Turn on predictive lead scoring or name your score property in the YAML.");
    }
    const sampled = found.filter((property) => property.filledCount !== null && property.totalCount > 0);
    if (sampled.length === 0) {
      return finding(rule, "missing", "The lead-score property was not in the contact sample.", "Request the score property on the contact read.");
    }
    const empty = sampled.filter((property) => (property.filledCount ?? 0) === 0);
    if (empty.length > 0) {
      return finding(rule, "broken", "A lead-score property exists but the sample has no values.", "Check that scoring is calculating, then sample again.");
    }
    return finding(rule, "working", "A lead-score property has values in the sample.", "Review the score fit before using it as an enrolment rule.");
  },

  "program.subscription-types": ({ snapshot, rule }) => {
    const blocked = blockedFinding(rule, snapshot, "subscriptions", "Grant the communication-preferences read scope and run the audit again.");
    if (blocked) return blocked;
    if (snapshot.subscriptionTypes.length > 0) {
      return finding(rule, "working", `${snapshot.subscriptionTypes.length} subscription type(s) are defined.`, "Map each marketing email to one subscription type.");
    }
    return finding(rule, "missing", "No email subscription type was returned.", "Create subscription types before the next marketing send.");
  },

  "program.campaigns": ({ snapshot, rule }) => {
    const pagesBlocked = blockedFinding(rule, snapshot, "landing-pages", "Grant the CMS read scope and run the audit again.");
    const emailsBlocked = blockedFinding(rule, snapshot, "emails", "Grant the marketing email read scope and run the audit again.");
    if (pagesBlocked && emailsBlocked) return pagesBlocked;
    const assets = [
      ...snapshot.landingPages.filter((page) => page.published && page.hasCampaign !== null),
      ...snapshot.emails.filter((email) => email.published && email.hasCampaign !== null),
    ];
    if (assets.length === 0) {
      return finding(rule, "missing", "No published page or email was available.", "Publish an asset before judging campaign links.");
    }
    const bare = assets.filter((asset) => asset.hasCampaign === false).length;
    if (bare === 0) {
      return finding(rule, "working", "Published pages and emails are linked to a campaign.", "Keep one campaign per offer.");
    }
    return finding(rule, "broken", `${bare} published page or email asset(s) have no campaign.`, "Attach each live asset to a campaign.");
  },

  "brand.logo": ({ snapshot, rule }) => pageMark(rule, snapshot, (html) => /logo/i.test(html) || /<svg[\s>]/i.test(html), "logo image or SVG", "Put the logo in the shared page header."),

  "brand.favicon": ({ snapshot, rule }) => pageMark(rule, snapshot, (html) => /rel=["'](?:shortcut icon|icon|apple-touch-icon)/i.test(html), "favicon", "Add a rel=icon link in the page head."),

  "brand.heading": ({ snapshot, rule }) => pageMark(rule, snapshot, (html) => /<h1[\s>]/i.test(html), "level-one heading", "Give each landing page one h1."),

  "brand.colours": ({ snapshot, rule }) => {
    const pages = pageHtml(rule, snapshot);
    if ("blocked" in pages) return pages.blocked;
    const loud = pages.html.filter((html) => colourCount(html) > num(rule.params, "maxColours", 8));
    const styled = pages.html.filter((html) => colourCount(html) > 0 || /stylesheet|\.css/i.test(html));
    if (pages.html.length === 0) {
      return finding(rule, "missing", "Published landing page HTML was not fetched.", "Fetch the page before judging colours.");
    }
    if (loud.length > 0) {
      return finding(rule, "broken", `${loud.length} published page(s) use more than the colour limit.`, "Keep the page on the shared palette.");
    }
    if (styled.length === pages.html.length) {
      return finding(rule, "working", "Published pages use a stylesheet or a small colour set.", "Keep new pages on that palette.");
    }
    return finding(rule, "missing", "Fetched HTML has no colour values and no stylesheet.", "Publish the page styles with the HTML or the stylesheet link.");
  },

  "email.subscription-coverage": ({ snapshot, rule }) => {
    const blocked = blockedFinding(rule, snapshot, "emails", "Grant the marketing email read scope and run the audit again.");
    if (blocked) return blocked;
    const published = snapshot.emails.filter((email) => email.published);
    if (published.length === 0) {
      return finding(rule, "missing", "No published marketing email was returned.", "Publish one email before judging subscription types.");
    }
    const bare = published.filter((email) => !email.hasSubscription);
    if (bare.length === 0) {
      return finding(rule, "working", "Published emails are tied to a subscription type.", "Keep one subscription type per email.");
    }
    return finding(rule, "broken", `${bare.length} published email(s) have no subscription type.`, "Choose a subscription type before the next send.");
  },

  "program.owners": ({ snapshot, rule }) => {
    const blocked = blockedFinding(rule, snapshot, "owners", "Grant the owners read scope and run the audit again.");
    if (blocked) return blocked;
    if (snapshot.owners.length > 0) {
      return finding(rule, "working", `${snapshot.owners.length} owner record(s) are present.`, "Give every new contact and deal an owner.");
    }
    return finding(rule, "missing", "No owner record was returned.", "Add the people who should own contacts and deals.");
  },
};

function pageHtml(rule: CheckRule, snapshot: PortalSnapshot): { blocked: Finding } | { html: string[] } {
  const blocked = blockedFinding(rule, snapshot, "landing-pages", "Grant the CMS read scope and run the audit again.");
  if (blocked) return { blocked };
  return { html: snapshot.landingPages.filter((page) => page.published && page.html).map((page) => page.html ?? "") };
}

function pageMark(rule: CheckRule, snapshot: PortalSnapshot, present: (html: string) => boolean, noun: string, fix: string): Finding {
  const pages = pageHtml(rule, snapshot);
  if ("blocked" in pages) return pages.blocked;
  if (pages.html.length === 0) {
    return finding(rule, "missing", "Published landing page HTML was not fetched.", "Fetch the page before judging the brand.");
  }
  const bare = pages.html.filter((html) => !present(html));
  if (bare.length === 0) {
    return finding(rule, "working", `Published pages include a ${noun}.`, fix);
  }
  return finding(rule, "broken", `${bare.length} published page(s) have no ${noun}.`, fix);
}

function colourCount(html: string): number {
  const found = html.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
  const neutrals = new Set(["#fff", "#ffffff", "#000", "#000000"]);
  return new Set(found.map((colour) => colour.toLowerCase()).filter((colour) => !neutrals.has(colour) && (colour.length === 4 || colour.length === 7))).size;
}

export function runCheck(rule: CheckRule, snapshot: PortalSnapshot): Finding {
  const fn = checks[rule.id];
  if (!fn) {
    return finding(
      rule,
      "missing",
      `No check implementation is registered for ${rule.id}.`,
      "Add a function for this id, or remove the YAML entry.",
    );
  }
  return fn({ snapshot, rule });
}
