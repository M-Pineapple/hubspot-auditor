# HubSpot audit: Harbour Glass Co

This report uses a fictional sample portal. It is not a customer account.

Score: **30** (share of checks that are working).

| Status | Count |
| --- | ---: |
| Working | 14 |
| Broken | 21 |
| Missing | 11 |

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

### Tracking on landing pages

- Severity: high
- Check: `brand.page-tracking`
- Evidence: 1 published landing page(s) have no tracking script.
- Fix: Add the portal tracking code to the landing page template.

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

### Email hooks by buyer stage

- Severity: high
- Check: `journey.stage-hooks`
- Evidence: 6 journey stage(s) have no matching published email: lead, marketingqualifiedlead, salesqualifiedlead, opportunity, customer, evangelist.
- Fix: Add one email or workflow for each uncovered stage.

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

### Favicon on landing pages

- Severity: medium
- Check: `brand.favicon`
- Evidence: 1 published page(s) have no favicon.
- Fix: Add a rel=icon link in the page head.

### Landing page titles and descriptions

- Severity: medium
- Check: `brand.page-meta`
- Evidence: 1 published landing page(s) are missing a title or meta description.
- Fix: Fill the HTML title and meta description before the next campaign.

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

### Campaign links on live assets

- Severity: medium
- Check: `program.campaigns`
- Evidence: 2 published page or email asset(s) have no campaign.
- Fix: Attach each live asset to a campaign.

## Missing

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
- Evidence: 1 pipeline(s) have a stage that does not require the configured fields.
- Fix: Mark those properties required before a record can enter the stage.

### Automation on stage change

- Severity: medium
- Check: `pipelines.stage-automation`
- Evidence: 1 pipeline(s) have no stage-change automation.
- Fix: Add a workflow or stage action for the first handoff stage.

### Dynamic lists

- Severity: medium
- Check: `program.dynamic-lists`
- Evidence: No dynamic list was returned.
- Fix: Build dynamic lists for the stages you email.

### Lead score

- Severity: medium
- Check: `program.lead-score`
- Evidence: No lead-score property was returned.
- Fix: Turn on predictive lead scoring or name your score property in the YAML.

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

### Logo on landing pages

- Severity: high
- Check: `brand.logo`
- Evidence: Published pages include a logo image or SVG.
- Fix: Put the logo in the shared page header.

### Landing page call to action

- Severity: high
- Check: `brand.page-cta`
- Evidence: Published landing pages include a call to action.
- Fix: Point the action at one form or one meeting link.

### Published landing pages

- Severity: high
- Check: `brand.published-pages`
- Evidence: 1 landing page(s) are published.
- Fix: Keep a draft only while it is still being edited.

### Subscription type on published emails

- Severity: high
- Check: `email.subscription-coverage`
- Evidence: Published emails are tied to a subscription type.
- Fix: Keep one subscription type per email.

### Live forms

- Severity: high
- Check: `forms.live-forms`
- Evidence: 2 form(s) are not archived.
- Fix: Archive forms that no page still embeds.

### Email subscription types

- Severity: high
- Check: `program.subscription-types`
- Evidence: 1 subscription type(s) are defined.
- Fix: Map each marketing email to one subscription type.

### Lifecycle funnel

- Severity: high
- Check: `reporting.lifecycle-funnel`
- Evidence: The contact sample spans 4 lifecycle stages.
- Fix: Use the same stage names on the funnel report.

### Landing page colour palette

- Severity: medium
- Check: `brand.colours`
- Evidence: Published pages use a stylesheet or a small colour set.
- Fix: Keep new pages on that palette.

### Page heading

- Severity: medium
- Check: `brand.heading`
- Evidence: Published pages include a level-one heading.
- Fix: Give each landing page one h1.

### Record owners

- Severity: medium
- Check: `program.owners`
- Evidence: 1 owner record(s) are present.
- Fix: Give every new contact and deal an owner.

### Dashboards

- Severity: medium
- Check: `reporting.dashboards`
- Evidence: 1 dashboard(s) are present.
- Fix: Keep one operating dashboard for the revenue team.

### Extra brand phrases

- Severity: low
- Check: `brand.markers`
- Evidence: No extra phrases are configured. Logo, favicon, heading, and colour checks still run.
- Fix: Add params.markers only for words that must appear verbatim.

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
- high: Tracking on landing pages. Add the portal tracking code to the landing page template.
- high: Duplicate companies. Merge companies that share a domain.
- high: Duplicate contacts. Merge the duplicate contacts and turn on a create-time duplicate rule.
- high: Required properties filled. Make the thin properties required on the create forms and backfill the blanks.
- high: Workflow health. Open the errored workflows and fix the failing action.
- high: Form field mapping. Map each field to a contact or company property.
- high: Spam protection. Turn on CAPTCHA or another spam control.
- high: Sync errors. Open the failing sync and replay or pause it.
- high: Email hooks by buyer stage. Add one email or workflow for each uncovered stage.
- high: Stale deals. Create a workflow that tasks the owner when a deal goes stale.
- high: Cookie banner. Add a consent banner before non-essential HubSpot cookies load.
- high: Original source attribution. Stop blank imports from clearing original source.

### 60 days

- medium: Favicon on landing pages. Add a rel=icon link in the page head.
- medium: Landing page titles and descriptions. Fill the HTML title and meta description before the next campaign.
- medium: Lifecycle and lead status. Clear the conflicting lead status when lifecycle stage changes.
- medium: Webhook subscriptions. Repair or remove the inactive subscription.
- medium: Deal stage probabilities. Set a realistic probability on each open stage.
- medium: Campaign links on live assets. Attach each live asset to a campaign.

### 90 days

- medium: Nurture sequence. Add one short nurture for new leads.
- medium: Unengaged contacts. Add a sunset workflow after a set number of unopened emails.
- medium: Follow-up email. Add a follow-up email or a workflow enrolment on submit.
- medium: Required fields per stage. Mark those properties required before a record can enter the stage.
- medium: Automation on stage change. Add a workflow or stage action for the first handoff stage.
- medium: Dynamic lists. Build dynamic lists for the stages you email.
- medium: Lead score. Turn on predictive lead scoring or name your score property in the YAML.
- medium: Attribution reports. Add an attribution report for paid and organic channels.
- medium: UTM capture. Pass UTM parameters into hidden form fields.
- low: Unused custom properties. Archive unused properties or start collecting them on a form.
- low: Unused forms. Embed the form or archive it.
