# HubSpot audit: Harbour Glass Co

This report uses a fictional sample portal. It is not a customer account.

Score: **30** (share of checks that are working). A check that needs operator confirmation is not a pass.

| Status | Count |
| --- | ---: |
| Working | 14 |
| Broken | 21 |
| Missing | 11 |
| Needs operator confirmation | 0 |

## Broken

### Required properties filled

- Severity: high
- Process: lead routing
- Check: `crm.missing-required-properties`
- Evidence: 1 required property name(s) are below the fill ratio: email.
- Fix: Make the thin properties required on the create forms and backfill the blanks.
- Owner: RevOps
- Retest: Agree which fields are required, backfill any field still under the ratio, and rerun the audit.

### Workflow health

- Severity: high
- Process: lead routing
- Check: `email.workflows-health`
- Evidence: 1 workflow(s) are in error. 1 active workflow(s) have no enrolment.
- Fix: Open the errored workflows and fix the failing action.
- Owner: RevOps
- Retest: Open each errored workflow, fix the failing action, and confirm a new test contact enrols.

### Form field mapping

- Severity: high
- Process: lead routing
- Check: `forms.field-mapping`
- Evidence: 1 form field(s) have no property mapping.
- Fix: Map each field to a contact or company property.
- Owner: Marketing ops
- Retest: Submit the form once and confirm each answer lands on the intended contact property.

### Sync errors

- Severity: high
- Process: lead routing
- Check: `integrations.sync-errors`
- Evidence: 1 app(s) and 1 webhook(s) report sync errors.
- Fix: Open the failing sync and replay or pause it.
- Owner: Integration owner
- Retest: Find the integration that created the bad row, correct that route, and rerun a ten-row import.

### Email hooks by buyer stage

- Severity: high
- Process: lead routing
- Check: `journey.stage-hooks`
- Evidence: 6 journey stage(s) have no matching published email: lead, marketingqualifiedlead, salesqualifiedlead, opportunity, customer and 1 more.
- Fix: Add one email or workflow for each uncovered stage.
- Owner: Marketing ops
- Retest: Move one test contact into each uncovered stage and confirm the matching email or workflow exists.

### Stale deals

- Severity: high
- Process: lead routing
- Check: `pipelines.stale-deals`
- Evidence: 1 sampled deal(s) have not been updated for 30 days or more.
- Fix: Create a workflow that tasks the owner when a deal goes stale.
- Owner: Sales ops
- Retest: Agree the stale-day threshold, let the task workflow fire on one quiet deal, and rerun the audit.

### Lifecycle and lead status

- Severity: medium
- Process: lead routing
- Check: `crm.lifecycle-lead-status`
- Evidence: 1 contact(s) use a conflicting lifecycle stage and lead status.
- Fix: Clear the conflicting lead status when lifecycle stage changes.
- Owner: Sales ops
- Retest: Agree the allowed lifecycle and lead-status pairs, clear any conflicting row, and rerun the audit.

### Webhook subscriptions

- Severity: medium
- Process: lead routing
- Check: `integrations.webhook-subscriptions`
- Evidence: 1 webhook subscription(s) are inactive.
- Fix: Repair or remove the inactive subscription.
- Owner: Integration owner
- Retest: Send one test event and confirm the subscription receives it.

### GDPR consent on forms

- Severity: critical
- Process: consent
- Check: `forms.gdpr-consent`
- Evidence: 1 live form(s) have no GDPR consent field.
- Fix: Add a consent checkbox and store the lawful basis.
- Owner: Marketing ops
- Retest: Submit the form and confirm the contact stores the consent checkbox and the lawful basis.

### Cookie banner

- Severity: high
- Process: consent
- Check: `tracking.cookie-banner`
- Evidence: The public page does not show a known cookie-banner marker.
- Fix: Add a consent banner before non-essential HubSpot cookies load.
- Owner: Marketing ops
- Retest: Load the page in a fresh browser and confirm non-essential cookies wait for the banner.

### Sender domain authentication

- Severity: critical
- Process: deliverability
- Check: `email.sender-authentication`
- Evidence: 1 sender domain(s) are missing a pass on SPF, DKIM, or DMARC.
- Fix: Publish the missing DNS records before the next campaign.
- Owner: Marketing ops
- Retest: Query the sender domain and confirm SPF, DKIM, and DMARC each return a pass.

### Spam protection

- Severity: high
- Process: conversion
- Check: `forms.spam-protection`
- Evidence: 1 live form(s) have no spam protection.
- Fix: Turn on CAPTCHA or another spam control.
- Owner: Marketing ops
- Retest: Submit the form once as a person and confirm a bot-style submission is blocked or dropped.

### Favicon on landing pages

- Severity: medium
- Process: conversion
- Check: `brand.favicon`
- Evidence: 1 published page(s) have no favicon.
- Fix: Add a rel=icon link in the page head.
- Owner: Marketing ops
- Retest: Reload the page and confirm the browser tab shows the favicon.

### Landing page titles and descriptions

- Severity: medium
- Process: conversion
- Check: `brand.page-meta`
- Evidence: 1 published landing page(s) are missing a title or meta description.
- Fix: Fill the HTML title and meta description before the next campaign.
- Owner: Marketing ops
- Retest: View the page source and confirm the title and meta description match the offer.

### Tracking code on the public site

- Severity: critical
- Process: reporting
- Check: `tracking.install-code`
- Evidence: The public page HTML does not include the HubSpot tracking script.
- Fix: Add the portal tracking code to the site layout.
- Owner: Marketing ops
- Retest: Load the public page and confirm the HubSpot tracking script request returns.

### Tracking on landing pages

- Severity: high
- Process: reporting
- Check: `brand.page-tracking`
- Evidence: 1 published landing page(s) have no tracking script.
- Fix: Add the portal tracking code to the landing page template.
- Owner: Marketing ops
- Retest: Load the landing page and confirm the tracking script request returns.

### Original source attribution

- Severity: high
- Process: reporting
- Check: `tracking.original-source`
- Evidence: Original source is missing on too many sampled contacts.
- Fix: Stop blank imports from clearing original source.
- Owner: Marketing ops
- Retest: Import one new contact and confirm the import does not clear original source.

### Deal stage probabilities

- Severity: medium
- Process: reporting
- Check: `pipelines.stage-probabilities`
- Evidence: 1 later deal stage(s) are below 40% probability.
- Fix: Set a realistic probability on each open stage.
- Owner: Sales ops
- Retest: Agree the probability floor, set it on each open stage, and rerun the audit.

### Campaign links on live assets

- Severity: medium
- Process: reporting
- Check: `program.campaigns`
- Evidence: 2 published page or email asset(s) have no campaign.
- Fix: Attach each live asset to a campaign.
- Owner: Marketing ops
- Retest: Open each live asset and confirm it is attached to the campaign for that offer.

### Duplicate companies

- Severity: high
- Process: data hygiene
- Check: `crm.duplicate-companies`
- Evidence: 1 domain(s) are shared by more than one company.
- Fix: Merge companies that share a domain.
- Owner: RevOps
- Retest: Import two companies that share a domain and confirm they are blocked or merged.

### Duplicate contacts

- Severity: high
- Process: data hygiene
- Check: `crm.duplicate-contacts`
- Evidence: 1 email address(es) are shared by more than one contact.
- Fix: Merge the duplicate contacts and turn on a create-time duplicate rule.
- Owner: RevOps
- Retest: Import ten rows that repeat one email and confirm HubSpot does not create a second contact.

## Missing

### Required fields per stage

- Severity: critical
- Process: billing
- Check: `pipelines.required-fields`
- Evidence: 1 pipeline(s) have a stage that does not require the configured fields: amount.
- Fix: Mark those properties required before a record can enter the stage.
- Owner: Sales ops
- Retest: Move a test deal into the stage with the field blank and confirm HubSpot blocks the move.

### Nurture sequence

- Severity: medium
- Process: lead routing
- Check: `email.nurture-sequence`
- Evidence: No active nurture sequence was found.
- Fix: Add one short nurture for new leads.
- Owner: Marketing ops
- Retest: Enrol one new lead and confirm the nurture sends, then stops when the contact becomes a customer.

### Automation on stage change

- Severity: medium
- Process: lead routing
- Check: `pipelines.stage-automation`
- Evidence: 1 pipeline(s) have no stage-change automation.
- Fix: Add a workflow or stage action for the first handoff stage.
- Owner: RevOps
- Retest: Move one test deal into the handoff stage and confirm the workflow enrols that deal.

### Dynamic lists

- Severity: medium
- Process: lead routing
- Check: `program.dynamic-lists`
- Evidence: No dynamic list was returned.
- Fix: Build dynamic lists for the stages you email.
- Owner: Marketing ops
- Retest: Change one contact's lifecycle stage and confirm the dynamic list gains or loses that contact.

### Lead score

- Severity: medium
- Process: lead routing
- Check: `program.lead-score`
- Evidence: No lead-score property was returned.
- Fix: Turn on predictive lead scoring or name your score property in the YAML.
- Owner: RevOps
- Retest: Open a scored contact and confirm the score property has a current value.

### Unengaged contacts

- Severity: medium
- Process: deliverability
- Check: `email.unengaged-handling`
- Evidence: No workflow handles unengaged contacts.
- Fix: Add a sunset workflow after a set number of unopened emails.
- Owner: Marketing ops
- Retest: Mark one test contact unengaged and confirm the sunset workflow suppresses further sends.

### Follow-up email

- Severity: medium
- Process: conversion
- Check: `forms.follow-up-email`
- Evidence: 1 embedded form(s) have no follow-up email.
- Fix: Add a follow-up email or a workflow enrolment on submit.
- Owner: Marketing ops
- Retest: Submit the embedded form from an inbox you control and confirm the follow-up arrives.

### Unused forms

- Severity: low
- Process: conversion
- Check: `forms.unused-forms`
- Evidence: 1 live form(s) are not embedded.
- Fix: Embed the form or archive it.
- Owner: Marketing ops
- Retest: Archive each unembedded form or place it on a page, then rerun the audit.

### Attribution reports

- Severity: medium
- Process: reporting
- Check: `reporting.attribution`
- Evidence: No attribution report was returned.
- Fix: Add an attribution report for paid and organic channels.
- Owner: Marketing ops
- Retest: Open the attribution report and confirm paid and organic channels both appear.

### UTM capture

- Severity: medium
- Process: reporting
- Check: `tracking.utm-capture`
- Evidence: UTM properties exist but most sampled values are empty.
- Fix: Pass UTM parameters into hidden form fields.
- Owner: Marketing ops
- Retest: Open the form with utm_source set and confirm the hidden field stores that value.

### Unused custom properties

- Severity: low
- Process: data hygiene
- Check: `crm.unused-custom-properties`
- Evidence: 1 custom property name(s) have no values: favourite_glass.
- Fix: Archive unused properties or start collecting them on a form.
- Owner: RevOps
- Retest: Archive each named property or place it on a form, then rerun and confirm the fill count is no longer zero.

## Needs operator confirmation

None.

## Working

### Record owners

- Severity: medium
- Process: lead routing
- Check: `program.owners`
- Evidence: 1 owner record(s) are present.
- Fix: Give every new contact and deal an owner.

### Subscription type on published emails

- Severity: high
- Process: deliverability
- Check: `email.subscription-coverage`
- Evidence: Published emails are tied to a subscription type.
- Fix: Keep one subscription type per email.

### Email subscription types

- Severity: high
- Process: deliverability
- Check: `program.subscription-types`
- Evidence: 1 subscription type(s) are defined.
- Fix: Map each marketing email to one subscription type.

### Logo on landing pages

- Severity: high
- Process: conversion
- Check: `brand.logo`
- Evidence: Published pages include a logo image or SVG.
- Fix: Put the logo in the shared page header.

### Landing page call to action

- Severity: high
- Process: conversion
- Check: `brand.page-cta`
- Evidence: Published landing pages include a call to action.
- Fix: Point the action at one form or one meeting link.

### Published landing pages

- Severity: high
- Process: conversion
- Check: `brand.published-pages`
- Evidence: 1 landing page(s) are published.
- Fix: Keep a draft only while it is still being edited.

### Live forms

- Severity: high
- Process: conversion
- Check: `forms.live-forms`
- Evidence: 2 form(s) are not archived.
- Fix: Archive forms that no page still embeds.

### Landing page colour palette

- Severity: medium
- Process: conversion
- Check: `brand.colours`
- Evidence: Published pages use a stylesheet or a small colour set.
- Fix: Keep new pages on that palette.

### Page heading

- Severity: medium
- Process: conversion
- Check: `brand.heading`
- Evidence: Published pages include a level-one heading.
- Fix: Give each landing page one h1.

### Extra brand phrases

- Severity: low
- Process: conversion
- Check: `brand.markers`
- Evidence: No extra phrases are configured. Logo, favicon, heading, and colour checks still run.
- Fix: Add params.markers only for words that must appear verbatim.

### Lifecycle funnel

- Severity: high
- Process: reporting
- Check: `reporting.lifecycle-funnel`
- Evidence: The contact sample spans 4 lifecycle stages.
- Fix: Use the same stage names on the funnel report.

### Dashboards

- Severity: medium
- Process: reporting
- Check: `reporting.dashboards`
- Evidence: 1 dashboard(s) are present.
- Fix: Keep one operating dashboard for the revenue team.

### Ticket pipeline

- Severity: low
- Process: reporting
- Check: `pipelines.ticket-pipeline`
- Evidence: 1 ticket pipeline(s) are defined.
- Fix: Keep a closed stage and a required resolution field.

### Connected apps

- Severity: low
- Process: data hygiene
- Check: `integrations.connected-apps`
- Evidence: 1 app(s) are connected.
- Fix: Remove apps you no longer use.

## 30/60/90-day plan

### 30 days

- high · lead routing · Required properties filled (`crm.missing-required-properties`). Make the thin properties required on the create forms and backfill the blanks.
  - Owner: RevOps.
  - Retest: Agree which fields are required, backfill any field still under the ratio, and rerun the audit.
- high · lead routing · Workflow health (`email.workflows-health`). Open the errored workflows and fix the failing action.
  - Owner: RevOps.
  - Retest: Open each errored workflow, fix the failing action, and confirm a new test contact enrols.
- high · lead routing · Form field mapping (`forms.field-mapping`). Map each field to a contact or company property.
  - Owner: Marketing ops.
  - Retest: Submit the form once and confirm each answer lands on the intended contact property.
- high · lead routing · Sync errors (`integrations.sync-errors`). Open the failing sync and replay or pause it.
  - Owner: Integration owner.
  - Retest: Find the integration that created the bad row, correct that route, and rerun a ten-row import.
- high · lead routing · Email hooks by buyer stage (`journey.stage-hooks`). Add one email or workflow for each uncovered stage.
  - Owner: Marketing ops.
  - Retest: Move one test contact into each uncovered stage and confirm the matching email or workflow exists.
- high · lead routing · Stale deals (`pipelines.stale-deals`). Create a workflow that tasks the owner when a deal goes stale.
  - Owner: Sales ops.
  - Retest: Agree the stale-day threshold, let the task workflow fire on one quiet deal, and rerun the audit.
- critical · consent · GDPR consent on forms (`forms.gdpr-consent`). Add a consent checkbox and store the lawful basis.
  - Owner: Marketing ops.
  - Retest: Submit the form and confirm the contact stores the consent checkbox and the lawful basis.
- high · consent · Cookie banner (`tracking.cookie-banner`). Add a consent banner before non-essential HubSpot cookies load.
  - Owner: Marketing ops.
  - Retest: Load the page in a fresh browser and confirm non-essential cookies wait for the banner.
- critical · deliverability · Sender domain authentication (`email.sender-authentication`). Publish the missing DNS records before the next campaign.
  - Owner: Marketing ops.
  - Retest: Query the sender domain and confirm SPF, DKIM, and DMARC each return a pass.
- high · conversion · Spam protection (`forms.spam-protection`). Turn on CAPTCHA or another spam control.
  - Owner: Marketing ops.
  - Retest: Submit the form once as a person and confirm a bot-style submission is blocked or dropped.
- critical · reporting · Tracking code on the public site (`tracking.install-code`). Add the portal tracking code to the site layout.
  - Owner: Marketing ops.
  - Retest: Load the public page and confirm the HubSpot tracking script request returns.
- high · reporting · Tracking on landing pages (`brand.page-tracking`). Add the portal tracking code to the landing page template.
  - Owner: Marketing ops.
  - Retest: Load the landing page and confirm the tracking script request returns.
- high · reporting · Original source attribution (`tracking.original-source`). Stop blank imports from clearing original source.
  - Owner: Marketing ops.
  - Retest: Import one new contact and confirm the import does not clear original source.
- high · data hygiene · Duplicate companies (`crm.duplicate-companies`). Merge companies that share a domain.
  - Owner: RevOps.
  - Retest: Import two companies that share a domain and confirm they are blocked or merged.
- high · data hygiene · Duplicate contacts (`crm.duplicate-contacts`). Merge the duplicate contacts and turn on a create-time duplicate rule.
  - Owner: RevOps.
  - Retest: Import ten rows that repeat one email and confirm HubSpot does not create a second contact.

### 60 days

- critical · billing · Required fields per stage (`pipelines.required-fields`). Mark those properties required before a record can enter the stage.
  - Owner: Sales ops.
  - Retest: Move a test deal into the stage with the field blank and confirm HubSpot blocks the move.
- medium · lead routing · Lifecycle and lead status (`crm.lifecycle-lead-status`). Clear the conflicting lead status when lifecycle stage changes.
  - Owner: Sales ops.
  - Retest: Agree the allowed lifecycle and lead-status pairs, clear any conflicting row, and rerun the audit.
- medium · lead routing · Webhook subscriptions (`integrations.webhook-subscriptions`). Repair or remove the inactive subscription.
  - Owner: Integration owner.
  - Retest: Send one test event and confirm the subscription receives it.
- medium · conversion · Favicon on landing pages (`brand.favicon`). Add a rel=icon link in the page head.
  - Owner: Marketing ops.
  - Retest: Reload the page and confirm the browser tab shows the favicon.
- medium · conversion · Landing page titles and descriptions (`brand.page-meta`). Fill the HTML title and meta description before the next campaign.
  - Owner: Marketing ops.
  - Retest: View the page source and confirm the title and meta description match the offer.
- medium · reporting · Deal stage probabilities (`pipelines.stage-probabilities`). Set a realistic probability on each open stage.
  - Owner: Sales ops.
  - Retest: Agree the probability floor, set it on each open stage, and rerun the audit.
- medium · reporting · Campaign links on live assets (`program.campaigns`). Attach each live asset to a campaign.
  - Owner: Marketing ops.
  - Retest: Open each live asset and confirm it is attached to the campaign for that offer.

### 90 days

- medium · lead routing · Nurture sequence (`email.nurture-sequence`). Add one short nurture for new leads.
  - Owner: Marketing ops.
  - Retest: Enrol one new lead and confirm the nurture sends, then stops when the contact becomes a customer.
- medium · lead routing · Automation on stage change (`pipelines.stage-automation`). Add a workflow or stage action for the first handoff stage.
  - Owner: RevOps.
  - Retest: Move one test deal into the handoff stage and confirm the workflow enrols that deal.
- medium · lead routing · Dynamic lists (`program.dynamic-lists`). Build dynamic lists for the stages you email.
  - Owner: Marketing ops.
  - Retest: Change one contact's lifecycle stage and confirm the dynamic list gains or loses that contact.
- medium · lead routing · Lead score (`program.lead-score`). Turn on predictive lead scoring or name your score property in the YAML.
  - Owner: RevOps.
  - Retest: Open a scored contact and confirm the score property has a current value.
- medium · deliverability · Unengaged contacts (`email.unengaged-handling`). Add a sunset workflow after a set number of unopened emails.
  - Owner: Marketing ops.
  - Retest: Mark one test contact unengaged and confirm the sunset workflow suppresses further sends.
- medium · conversion · Follow-up email (`forms.follow-up-email`). Add a follow-up email or a workflow enrolment on submit.
  - Owner: Marketing ops.
  - Retest: Submit the embedded form from an inbox you control and confirm the follow-up arrives.
- low · conversion · Unused forms (`forms.unused-forms`). Embed the form or archive it.
  - Owner: Marketing ops.
  - Retest: Archive each unembedded form or place it on a page, then rerun the audit.
- medium · reporting · Attribution reports (`reporting.attribution`). Add an attribution report for paid and organic channels.
  - Owner: Marketing ops.
  - Retest: Open the attribution report and confirm paid and organic channels both appear.
- medium · reporting · UTM capture (`tracking.utm-capture`). Pass UTM parameters into hidden form fields.
  - Owner: Marketing ops.
  - Retest: Open the form with utm_source set and confirm the hidden field stores that value.
- low · data hygiene · Unused custom properties (`crm.unused-custom-properties`). Archive unused properties or start collecting them on a form.
  - Owner: RevOps.
  - Retest: Archive each named property or place it on a form, then rerun and confirm the fill count is no longer zero.
