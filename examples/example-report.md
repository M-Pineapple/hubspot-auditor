# HubSpot audit: Harbour Glass Co

This report uses a fictional sample portal. It is not a customer account.

Score: **13** (share of checks that are working).

| Status | Count |
| --- | ---: |
| Working | 4 |
| Broken | 16 |
| Missing | 10 |

## Broken

### Sender domain authentication

- Severity: critical
- Check: `email.sender-authentication`
- Evidence: 1 sender domain(s) are missing a pass on SPF, DKIM, or DMARC.
- Fix: Publish the missing DNS records before the next campaign.

### GDPR consent on forms

- Severity: critical
- Check: `forms.gdpr-consent`
- Evidence: 1 live form(s) have no GDPR consent field.
- Fix: Add a consent checkbox and store the lawful basis.

### Tracking code on the public site

- Severity: critical
- Check: `tracking.install-code`
- Evidence: The public page HTML does not include the HubSpot tracking script.
- Fix: Add the portal tracking code to the site layout.

### Duplicate companies

- Severity: high
- Check: `crm.duplicate-companies`
- Evidence: 1 domain(s) are shared by more than one company.
- Fix: Merge companies that share a domain.

### Duplicate contacts

- Severity: high
- Check: `crm.duplicate-contacts`
- Evidence: 1 email address(es) are shared by more than one contact.
- Fix: Merge the duplicate contacts and turn on a create-time duplicate rule.

### Required properties filled

- Severity: high
- Check: `crm.missing-required-properties`
- Evidence: 1 required property name(s) are below the fill ratio: email.
- Fix: Make the thin properties required on the create forms and backfill the blanks.

### Workflow health

- Severity: high
- Check: `email.workflows-health`
- Evidence: 1 workflow(s) are in error. 1 active workflow(s) have no enrolment.
- Fix: Open the errored workflows and fix the failing action.

### Form field mapping

- Severity: high
- Check: `forms.field-mapping`
- Evidence: 1 form field(s) have no property mapping.
- Fix: Map each field to a contact or company property.

### Spam protection

- Severity: high
- Check: `forms.spam-protection`
- Evidence: 1 live form(s) have no spam protection.
- Fix: Turn on CAPTCHA or another spam control.

### Sync errors

- Severity: high
- Check: `integrations.sync-errors`
- Evidence: 1 app(s) and 1 webhook(s) report sync errors.
- Fix: Open the failing sync and replay or pause it.

### Stale deals

- Severity: high
- Check: `pipelines.stale-deals`
- Evidence: 1 sampled deal(s) have not been updated for 30 days or more.
- Fix: Create a workflow that tasks the owner when a deal goes stale.

### Cookie banner

- Severity: high
- Check: `tracking.cookie-banner`
- Evidence: The public page does not show a known cookie-banner marker.
- Fix: Add a consent banner before non-essential HubSpot cookies load.

### Original source attribution

- Severity: high
- Check: `tracking.original-source`
- Evidence: Original source is missing on too many sampled contacts.
- Fix: Stop blank imports from clearing original source.

### Lifecycle and lead status

- Severity: medium
- Check: `crm.lifecycle-lead-status`
- Evidence: 1 contact(s) use a conflicting lifecycle stage and lead status.
- Fix: Clear the conflicting lead status when lifecycle stage changes.

### Webhook subscriptions

- Severity: medium
- Check: `integrations.webhook-subscriptions`
- Evidence: 1 webhook subscription(s) are inactive.
- Fix: Repair or remove the inactive subscription.

### Deal stage probabilities

- Severity: medium
- Check: `pipelines.stage-probabilities`
- Evidence: 1 later deal stage(s) are below 40% probability.
- Fix: Set a realistic probability on each open stage.

## Missing

### Lifecycle funnel

- Severity: high
- Check: `reporting.lifecycle-funnel`
- Evidence: No lifecycle funnel report was returned.
- Fix: Build a funnel from subscriber to customer.

### Nurture sequence

- Severity: medium
- Check: `email.nurture-sequence`
- Evidence: No active nurture sequence was found.
- Fix: Add one short nurture for new leads.

### Unengaged contacts

- Severity: medium
- Check: `email.unengaged-handling`
- Evidence: No workflow handles unengaged contacts.
- Fix: Add a sunset workflow after a set number of unopened emails.

### Follow-up email

- Severity: medium
- Check: `forms.follow-up-email`
- Evidence: 1 embedded form(s) have no follow-up email.
- Fix: Add a follow-up email or a workflow enrolment on submit.

### Required fields per stage

- Severity: medium
- Check: `pipelines.required-fields`
- Evidence: 2 pipeline(s) have a stage that does not require the configured fields.
- Fix: Mark those properties required before a record can enter the stage.

### Automation on stage change

- Severity: medium
- Check: `pipelines.stage-automation`
- Evidence: 1 pipeline(s) have no stage-change automation.
- Fix: Add a workflow or stage action for the first handoff stage.

### Attribution reports

- Severity: medium
- Check: `reporting.attribution`
- Evidence: No attribution report was returned.
- Fix: Add an attribution report for paid and organic channels.

### UTM capture

- Severity: medium
- Check: `tracking.utm-capture`
- Evidence: UTM properties exist but most sampled values are empty.
- Fix: Pass UTM parameters into hidden form fields.

### Unused custom properties

- Severity: low
- Check: `crm.unused-custom-properties`
- Evidence: 1 custom property name(s) have no values: favourite_glass.
- Fix: Archive unused properties or start collecting them on a form.

### Unused forms

- Severity: low
- Check: `forms.unused-forms`
- Evidence: 1 live form(s) are not embedded.
- Fix: Embed the form or archive it.

## Working

### Live forms

- Severity: high
- Check: `forms.live-forms`
- Evidence: 2 form(s) are not archived.
- Fix: Archive forms that no page still embeds.

### Dashboards

- Severity: medium
- Check: `reporting.dashboards`
- Evidence: 1 dashboard(s) are present.
- Fix: Keep one operating dashboard for the revenue team.

### Connected apps

- Severity: low
- Check: `integrations.connected-apps`
- Evidence: 1 app(s) are connected.
- Fix: Remove apps you no longer use.

### Ticket pipeline

- Severity: low
- Check: `pipelines.ticket-pipeline`
- Evidence: 1 ticket pipeline(s) are defined.
- Fix: Keep a closed stage and a required resolution field.

## 30/60/90-day plan

### 30 days

- critical: Sender domain authentication. Publish the missing DNS records before the next campaign.
- critical: GDPR consent on forms. Add a consent checkbox and store the lawful basis.
- critical: Tracking code on the public site. Add the portal tracking code to the site layout.
- high: Duplicate companies. Merge companies that share a domain.
- high: Duplicate contacts. Merge the duplicate contacts and turn on a create-time duplicate rule.
- high: Required properties filled. Make the thin properties required on the create forms and backfill the blanks.
- high: Workflow health. Open the errored workflows and fix the failing action.
- high: Form field mapping. Map each field to a contact or company property.
- high: Spam protection. Turn on CAPTCHA or another spam control.
- high: Sync errors. Open the failing sync and replay or pause it.
- high: Stale deals. Create a workflow that tasks the owner when a deal goes stale.
- high: Cookie banner. Add a consent banner before non-essential HubSpot cookies load.
- high: Original source attribution. Stop blank imports from clearing original source.

### 60 days

- medium: Lifecycle and lead status. Clear the conflicting lead status when lifecycle stage changes.
- medium: Webhook subscriptions. Repair or remove the inactive subscription.
- medium: Deal stage probabilities. Set a realistic probability on each open stage.
- high: Lifecycle funnel. Build a funnel from subscriber to customer.

### 90 days

- medium: Nurture sequence. Add one short nurture for new leads.
- medium: Unengaged contacts. Add a sunset workflow after a set number of unopened emails.
- medium: Follow-up email. Add a follow-up email or a workflow enrolment on submit.
- medium: Required fields per stage. Mark those properties required before a record can enter the stage.
- medium: Automation on stage change. Add a workflow or stage action for the first handoff stage.
- medium: Attribution reports. Add an attribution report for paid and organic channels.
- medium: UTM capture. Pass UTM parameters into hidden form fields.
- low: Unused custom properties. Archive unused properties or start collecting them on a form.
- low: Unused forms. Embed the form or archive it.
