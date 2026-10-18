# Registration Flow Review and Promotion Proposal

> **Status (18 Oct 2026):** all three recommendations and the in-product promotion are implemented on `feat/registrations`; see the follow-ups section in `registrations.md`. Not done:
> - automatic FIFO promotion (the waiting list stays manual, with "Promote next")
> - editing an application through the status link
> - share-link click and form-completion tracking (no analytics in place)
> - the announcement email to existing managers

## Scope

This document reviews the new registration flow for seasons and tournaments. It covers:

- how a manager creates and publishes a registration window;
- how a team or player submits an application;
- how the manager processes applications;
- the current user-experience gaps;
- three recommended improvements;
- a proposed website promotion plan.

The recommendations are based on the current implementation in the registration components, routes, controller and public pages.

## Current end-to-end flow

### 1. Manager creates the competition

The manager creates a season or tournament first. The competition can exist without an active registration window. The registration window is created or updated separately.

For a season, the manager opens the season management screen and goes to **More → Applications**. For a tournament, the manager opens the tournament management screen and selects the **Applications** tab.

The manager can configure:

- whether applications are open;
- an optional deadline;
- an optional maximum number of teams;
- optional rules that applicants must accept;
- an optional entry-fee description.

The settings are saved together. The manager then copies the generated public URL and shares it with teams.

Relevant implementation:

- `frontend/src/pages/SeasonManager/components/MoreTab.tsx`
- `frontend/src/pages/TournamentManagement/pages/TournamentManagePage.tsx`
- `frontend/src/components/registrations/RegistrationsPanel.tsx`

### 2. Public visibility and entry point

The public season or tournament detail page requests the registration form state. The **Apply** button is rendered only when the registration window is currently open and the deadline has not passed.

This means the public page is the main entry point for discovery, while the copied link is the main entry point for direct sharing.

Relevant implementation:

- `frontend/src/components/registrations/RegistrationButton.tsx`
- `frontend/src/pages/SeasonDetail/Screen.tsx`
- `frontend/src/pages/TournamentDetail/Screen.tsx`

### 3. Applicant submits an application

The public form shows the competition name and the configured facts such as deadline, capacity and entry fee.

The applicant provides:

- team name, or an existing managed team for a season;
- contact name;
- email for tournament applications;
- optional phone number;
- optional note for the organiser;
- optional roster for tournament applications;
- acceptance of the competition rules when rules have been configured.

The behaviour differs by competition type:

- **Season:** the applicant must sign in. Once approved, the applicant becomes the manager of a new team or re-enters an existing team they manage.
- **Tournament:** no account is required. The applicant submits a team, contact email and optional roster. Approval creates a tournament team and its players.

The backend also provides duplicate protection, a client token for retry-safe submission, a honeypot and rate limiting for anonymous tournament applications.

Relevant implementation:

- `frontend/src/pages/Registration/Screen.tsx`
- `backend/src/controllers/registrationController.ts`
- `backend/src/routes/registrations.ts`

### 4. Manager processes applications

Applications appear in the manager inbox. Waiting applications are displayed first, followed by decided applications.

The manager can:

- approve an application;
- move a pending application to the waiting list;
- reject an application with an optional reason.

Approval is transactional and checks capacity again before creating the team. The applicant receives an email confirmation or decision email. The manager also receives an email notification for new applications.

### 5. Capacity and waiting-list behaviour

When a maximum team count is configured, new applications become waitlisted after the current teams and pending applications occupy the available places. Approval performs a second capacity check to avoid exceeding the limit.

The current design deliberately does not promote waiting-list entries automatically. A manager must decide when an entry should move forward.

## Three recommended improvements

### Recommendation 1: Turn publishing into a guided release flow

**Priority: High**

#### Current issue

The core publishing action is a checkbox labelled “Applications are open” inside a settings panel. It is saved together with all other settings. The experience does not clearly distinguish between:

- drafting the application form;
- previewing the form;
- publishing the form;
- sharing the form;
- closing the form again.

The location is also inconsistent: season managers find the feature under **More**, while tournament managers find it as a top-level tab.

#### Proposed experience

Introduce a short setup and publishing flow:

1. **Prepare the form**
   - Set the deadline, capacity, rules and fee.
   - Show a completion checklist.
   - Warn if no deadline or capacity has been configured, but allow the manager to continue.

2. **Preview the applicant view**
   - Open the exact public form in a preview mode.
   - Show the season/tournament name, sport, deadline, capacity, fee and rules.
   - Make it obvious which fields are required.

3. **Publish**
   - Use an explicit primary action such as **Publish applications**.
   - Confirm the public state, deadline and competition name before saving.
   - Return a visible success state: **Applications are now open**.

4. **Share**
   - Copy link.
   - Generate QR code.
   - Use the browser share sheet when available.
   - Provide a ready-made WhatsApp/email message.

5. **Manage the lifecycle**
   - Show **Open**, **Closed**, **Past deadline** and **Full** as separate states.
   - Add an explicit **Close applications** action.
   - Keep the public page available after closing so applicants see why submissions are no longer accepted.

#### Why this matters

Publishing is the moment when the feature creates value. It should feel like a deliberate launch, not like changing a hidden configuration flag. A preview also reduces the risk of publishing incomplete rules, a wrong deadline or an unclear fee description.

#### Suggested UI copy

- **Open applications**
- **Preview application form**
- **Publish applications**
- **Applications are now open**
- **Share this form with teams**
- **Close applications**

### Recommendation 2: Remove applicant friction and provide status continuity

**Priority: High**

#### Current issue

Season applicants must sign in. The sign-in link preserves the original application URL, but the **Create an account** link does not preserve the same destination. After creating an account, the user can therefore lose the application context.

Tournament applicants do not need an account, which is a good low-friction choice, but anonymous applicants have no dashboard entry, no status page and no way to withdraw the application through the product. They must rely on email communication.

#### Proposed experience

##### Season applications

- Preserve the full `next` destination through both sign-in and account creation.
- After account creation and activation, return the user to the application form.
- Explain before sign-in why an account is needed: “Your account will manage this team after approval.”
- Preserve already entered non-sensitive form data where practical, or at minimum preserve the competition and return path.

##### Tournament applications

Add a secure applicant status link:

- generate a random, single-purpose status token;
- include the link in the confirmation email;
- show status, submitted data and organiser decisions;
- allow withdrawal while the application is pending or waitlisted;
- optionally allow the applicant to correct contact details or roster before approval;
- expire or revoke the link after a defined period or after the application is decided.

The status page should not require a full account. The token should grant access only to that application and should not expose the manager inbox or unrelated competition data.

#### Why this matters

The form collects a meaningful commitment from a team. Applicants should be able to answer three questions without contacting the organiser:

1. Did my application arrive?
2. What is its current status?
3. Can I correct or withdraw it?

This is especially important for tournament applications, where the product intentionally avoids requiring an account.

#### Suggested UI copy

- **Continue to your application**
- **We received your application**
- **Check application status**
- **Withdraw application**
- **Your application is waiting for the organiser’s decision**

### Recommendation 3: Make capacity and the waiting list operationally clear

**Priority: Medium–High**

#### Current issue

The backend capacity check is safe, but the manager-facing count can be misleading. The inbox currently reports the number of existing teams, while pending applications are handled separately. A manager may therefore see a count such as “0 of 2 teams” while two pending applications already occupy the available places.

When a place becomes available, the oldest waitlisted application is not promoted automatically. This is valid as a policy choice, but the current interface does not make the manual process prominent enough.

#### Proposed experience

Use one shared capacity model everywhere:

```text
Approved teams: 6
Pending applications: 2
Waiting list: 3
Capacity: 8
```

Show the same information in:

- the manager settings panel;
- the manager inbox;
- the public application form;
- notification emails.

Add an explicit waiting-list policy setting:

- **Manual selection** — the organiser chooses who to promote;
- **Automatic FIFO** — the oldest waitlisted application is promoted when a place opens.

For manual selection, show a clear action such as **Promote next applicant**. For automatic FIFO, send both the applicant and manager a notification and give the applicant a short confirmation window if needed.

#### Recommended rules

- A withdrawn or rejected pending application frees a place.
- The next eligible waitlisted application is promoted according to the selected policy.
- A manager can override the order with an audit trail.
- Changing the maximum capacity recalculates the visible state immediately.
- The public form states whether a new application will be pending or waitlisted before submission.

#### Why this matters

Capacity is a promise to applicants. A clear and predictable waiting-list policy reduces manual follow-up, prevents unfair ordering and avoids confusion when the competition becomes full.

## Website promotion proposal

### Positioning

Promote the feature as a complete registration workflow, not merely as a form:

> **Open team applications in minutes. Share one link. Approve teams from one inbox.**

The message should target two audiences separately:

- **Organisers:** collect, review and approve teams without manual data entry.
- **Team captains:** apply to a competition using a simple public form.

### Recommended website placements

#### 1. Dedicated landing-page section

Add a prominent section to the main landing page, ideally near the existing organiser section:

**Headline:**

> Open registrations for your next season or tournament.

**Supporting text:**

> Set a deadline, capacity, rules and entry fee. Share one public link and manage every application from a single inbox.

**Three visual steps:**

1. Set up the application form.
2. Share the public link or QR code.
3. Approve teams and build the competition.

**Primary CTA:** `Open applications`

**Secondary CTA:** `See how it works`

The visual should show an application inbox with statuses such as **New**, **Waiting list** and **Approved**, rather than another standings-table mockup. That demonstrates the new value directly.

#### 2. Contextual promotion inside manager screens

Add a “New” badge and a short explanation in both season and tournament management:

- on the season overview, show a setup card when no registration window exists;
- on the tournament overview, show the same card before the Applications tab;
- after a competition is created, include “Open applications” in the setup checklist;
- after publishing, replace the setup card with the share panel.

This catches managers at the exact moment when they need to collect teams.

#### 3. Public competition discovery

Add an **Applications open** badge to public season and tournament cards. Add a filter such as **Open for applications** to the public competition lists.

This makes the feature useful even when a team does not already have a direct invitation link.

The public detail page should show:

- **Applications open**;
- deadline;
- available places;
- entry fee, if configured;
- a strong **Apply your team** button.

#### 4. Release note and help content

Add a release note to the **What’s new** page with a short product story:

> Teams can now apply to a season or tournament through a public form. Organisers configure the rules, deadline and capacity, then approve applications from one inbox.

Link the release note to a help article containing:

- how to open applications;
- how to share the link;
- how approval creates a team;
- how the waiting list works;
- what applicants receive by email.

#### 5. Share-ready communication

After publishing, generate a message that the manager can copy directly:

> Applications are open for **[Competition name]**. Apply your team by **[deadline]**: [link]

Provide variants for:

- WhatsApp or Messenger;
- email;
- a social post;
- a printable QR poster.

### Suggested launch sequence

1. Add the feature to the landing page and manager onboarding checklist.
2. Add the release note and help article.
3. Add the open-application badge and public-list filter.
4. Send an announcement email to existing managers.
5. Add in-product prompts only for competitions that have no registration window yet.

### Success metrics

Measure the full funnel rather than only page visits:

- percentage of managers who open a registration window;
- time from competition creation to publication;
- share-link clicks;
- application-form completion rate;
- percentage of applications approved;
- time from publication to first application;
- percentage of published windows with at least one application.

The most important first metric is **publication-to-first-application conversion**. It shows whether the feature is not only discoverable, but also understandable and useful to teams.

## Validation notes

- Frontend TypeScript check passed.
- Backend TypeScript check passed.
- The full backend test run could not be completed in the local environment because PostgreSQL was unavailable at `localhost:5432`.
- The local landing page was inspected in the browser; the current page promotes schedules, live tables and statistics, but does not yet promote team applications.

## Artifact-informed go-to-market direction

The supplied market and marketing artifact suggests that the registration feature should be positioned as an organiser acquisition feature, not as a standalone form builder.

The core commercial logic is:

1. The organiser creates the competition and opens applications.
2. Team managers join through a shared link, WhatsApp message, QR code or public competition page.
3. Teams and players become active users of the platform.
4. Public schedules, standings, results and round summaries create recurring visibility.
5. Those teams can introduce the platform to another organiser or competition.

This means the message should lead with the organiser's operational problem: collecting teams is fragmented across WhatsApp, email, spreadsheets and ad-hoc forms. The applicant-facing form is the visible proof of the solution, but the commercial buyer is the league or tournament organiser.

### Recommended market sequence

Treat the following sequence as a working hypothesis from the artifact, not as a validated market forecast:

- **Czech Republic first:** start with hobby hockey in Brno and Prague, then test floorball and small-sided football.
- **Slovakia next:** the language and competition structure are relatively close to the Czech market; Slovak localisation should be available before serious outreach.
- **Austria and German-speaking markets later:** approach larger leagues with German-language sales material and a more mature pricing and payment story.
- **Poland and the United Kingdom later:** enter after the product, onboarding and local proof points are strong enough to compete with established tools.

The artifact also recommends selling to organisers while allowing growth through teams. This should influence both the website information architecture and paid campaign targeting: organisers should see the primary CTA, while team managers should receive a simple application CTA after they encounter a shared link.

### Validation before scaling paid acquisition

Before investing materially in paid traffic, interview approximately 10 organisers and have direct conversations with 20–30 prospects. Validate:

- how applications are currently collected;
- how much time the organiser spends chasing incomplete team information;
- whether capacity, waitlists, payments, roster collection or match administration is the biggest pain;
- what the organiser currently pays, if anything;
- which proof point would make them publish their next season in ATM;
- whether a first season or tournament trial would remove the main adoption barrier.

Do not use market-size numbers, competitor pricing or claims such as “the first season is free” in an advertisement until they are confirmed as current and commercially approved. The artifact is useful strategic research, but those points should be treated as hypotheses until interviews and current competitor checks confirm them.

## Future promotion plan

### 1. Website positioning

Add a dedicated registration section to the landing page rather than mentioning the feature only in a release note.

Suggested hero copy:

> **Open registrations for your league or tournament in minutes.**
>
> Set the rules, deadline and capacity. Share one link. Review applications from one inbox and turn approved teams into a ready-to-manage competition.

Primary CTA:

> **Create your first registration window**

Secondary CTA:

> **See how team applications work**

The section should show a four-step visual sequence:

1. Configure the application window.
2. Share the public link or QR code.
3. Review approved, pending and waitlisted teams.
4. Start the competition with the accepted teams already in ATM.

The page should include a short organiser-specific proof panel:

- no manual copying from emails or spreadsheets;
- clear deadline and capacity rules;
- one place to approve, reject or waitlist teams;
- automatic confirmation messages for applicants;
- a public competition page that can continue to promote the league after registration closes.

### 2. In-product promotion

Use contextual prompts rather than a generic announcement banner:

- show a registration setup card when an organiser creates a new season or tournament;
- add **Open applications** to the setup checklist;
- show an **Applications open** badge on public competition cards;
- offer a share panel immediately after publication;
- display a small prompt when an organiser has teams missing from a new competition;
- provide a copy-ready WhatsApp message, email, social post and QR poster.

### 3. Direct and community promotion

The first acquisition motion should be high-touch and local:

- build a prospect list of hobby league organisers in Brno and Prague;
- offer a short setup call and help importing or creating the first teams;
- use rink and sports-hall relationships to place QR posters or introduce organisers;
- share useful public schedules, standings and result pages in relevant communities instead of posting generic product advertisements;
- collect organiser quotes, screenshots and short case studies from the first active competitions;
- approach equipment shops, sponsors and local sports partners once there is a repeatable organiser story.

### 4. Paid acquisition

Paid campaigns should start only after the landing page can measure the full activation path:

`ad click → organiser signup → competition created → registration published → first application received`

Recommended initial audiences:

- league and tournament organisers in Brno and Prague;
- hobby hockey administrators;
- later, sport-specific audiences for floorball and small-sided football;
- retargeting audiences that visited the registration page or watched at least part of a product video.

Separate organiser campaigns from applicant campaigns. A team manager searching for an application should not receive the same message as a person responsible for running an entire league.

## Paid marketing message examples

These are draft concepts. The offer language should be adjusted once pricing, trial rules and the target sport are confirmed.

### Message A: direct organiser pain point

**Headline:** Team applications without WhatsApp chaos

**Body:** Open applications for your league or tournament, set a deadline and capacity, then review every team from one clear inbox. No copying team details between messages and spreadsheets.

**CTA:** Create your registration window

### Message B: local hobby hockey campaign

**Headline:** Organise your Brno or Prague hobby league in one place

**Body:** Let teams apply through a public link, approve the right teams and start the season with schedules, standings and results already connected.

**CTA:** See ATM for organisers

### Message C: product outcome

**Headline:** Your league, its teams and registrations — together

**Body:** ATM helps organisers collect teams, manage the season and keep teams informed from the first application to the final result.

**CTA:** Try it for your next competition

### Message D: short retargeting ad

**Headline:** Still collecting teams manually?

**Body:** Share one application link. ATM handles the inbox, statuses and team creation after approval.

**CTA:** Open applications with ATM

### Recommended short-form ad copy

> Running a league or tournament? Stop collecting team details in scattered messages. Open one public registration, set your deadline and capacity, review applications in ATM and start with accepted teams already organised. **Create your first registration window.**

### Claims to avoid until verified

Avoid unsupported claims such as:

- “the only platform that does this”;
- exact competitor or market-size comparisons;
- guaranteed time savings;
- “free forever” or “first season free” unless the offer is approved and clearly defined;
- automatic payments or QR payments if those capabilities are not yet live.

## Video content strategy

The feature is well suited to screen-led video because the value is visible as a sequence of actions. The first videos should demonstrate the workflow rather than attempt to explain every ATM module.

### Video 1: 15–20 second paid social ad

Format: vertical 9:16, with a 1:1 cutdown for feeds.

Suggested storyboard:

1. **0–2 seconds:** animated pain point — overflowing WhatsApp messages and a spreadsheet with missing team details.
2. **2–5 seconds:** on-screen line: “Still collecting teams manually?”
3. **5–11 seconds:** screen recording of setting the deadline, capacity and rules.
4. **11–16 seconds:** show the public application form, then approve a team from the inbox.
5. **16–20 seconds:** show the competition with the approved team and a clear CTA.

Use large subtitles and keep the first frame understandable without sound.

### Video 2: 45–60 second product demo

Show one complete path:

- organiser creates a season or tournament;
- organiser opens applications;
- applicant submits a team;
- organiser sees the application and chooses approve, reject or waitlist;
- the accepted team appears in the competition.

This should be the main video on the landing page and the destination for people who click the short ad.

### Video 3: organiser case study

Combine a short recorded interview with screen footage:

- the organiser explains how applications were collected before ATM;
- the organiser shows the new workflow;
- the video ends with a concrete result, such as fewer manual follow-ups or a faster setup process.

Do not invent a numerical result. Use a qualitative quote until the outcome has been measured.

### Video 4: feature cutdowns

Create separate 6–10 second clips for:

- public application link;
- deadline and capacity;
- waitlist visibility;
- approval inbox;
- automatic team creation after approval.

These clips can be reused in retargeting, onboarding, release notes and social posts.

### Production guidelines

- record a clean browser viewport with realistic but anonymised data;
- hide email addresses, personal names and private competition information;
- use a cursor highlight, restrained zooms and short callout labels;
- add subtitles to every spoken or explanatory section;
- export 9:16, 1:1 and 16:9 versions from the same master edit;
- keep the interface recording slower than normal usage so viewers can follow it;
- create a reusable opening and closing animation using the ATM visual identity;
- include a UTM-tagged CTA and measure the landing-page action, not only video views.

## Candidate services for screen recordings and animated videos

### Recommended starting stack: Tella + Canva

**Tella** is a strong fit for polished product demos: it supports screen and camera recording, separate layouts, post-recording layout changes, captions, transitions, backgrounds and sharing. It is suitable when the video should feel more designed than a raw screen capture. See the [Tella feature overview](https://www.tella.com/features) and [custom layouts](https://landingpage.tella.com/features/custom-layouts).

**Canva** is useful for branded ad variants, animated titles, social templates, simple illustrations and final resizing. Its screen recorder can also be combined with editing, captions and branded elements. For desktop screen recording, verify the current platform requirements because the official help documentation describes the desktop app workflow for Mac and Windows. See [Canva Screen Recorder](https://www.canva.com/screen-recorder/) and [Canva's desktop app guidance](https://www.canva.com/help/screen-recorder/).

This combination is the best starting point if the team wants to produce several useful videos quickly without building a full motion-design pipeline.

### Screen Studio: best for highly polished screen-only demos

Screen Studio is a good option for clean product walkthroughs on macOS. Its strengths include automatic zooming around cursor activity, cursor and click treatment, backgrounds, annotations, webcam bubbles and GIF export. The official FAQ currently lists macOS 15 or later as a requirement, so it is not the safest choice for a mixed-device team. See the [Screen Studio FAQ](https://screenstudio.dev/faq/).

### Descript: best for narration, interviews and rapid revisions

Descript is useful when the video includes a voiceover, organiser interview or several language versions. Its workflow combines screen and camera recording with transcript-based editing, captions, overlays, transitions and text-driven corrections. It can also create styled captions and translated versions. See [Descript's screen and video recording overview](https://www.descript.com/blog/article/introducing-descript-video-and-screen-recording) and [Descript captions](https://www.descript.com/captions).

### VEED: best for browser-based team collaboration

VEED is a practical option when recording and editing should happen in the browser across different operating systems. It supports screen, camera and audio recording, captions, annotations and quick tutorial-style editing. See the [VEED screen recorder](https://www.veed.io/tools/screen-recorder) and [steps recorder](https://www.veed.io/tools/screen-recorder/steps-recorder).

### Adobe After Effects and Premiere: best for a premium campaign

Use Adobe After Effects and Premiere when the goal is a highly customised campaign with animated interface callouts, logo motion, 2D/3D elements or advanced compositing. After Effects is powerful for motion graphics, but it has a higher production cost and is unnecessary for the first validation videos. See [Adobe After Effects motion graphics](https://www.adobe.com/products/aftereffects/motion-graphics.html).

### Suggested production workflows

**Lean validation workflow:**

`Tella or Screen Studio → Canva → export social variants`

**Narrated demo workflow:**

`Tella or Screen Studio → Descript for narration and captions → Canva for branded cutdowns`

**Premium campaign workflow:**

`Screen capture → Premiere edit → After Effects motion graphics → final exports`

If only one service is selected initially, choose Tella for a cross-platform, presenter-friendly workflow. Choose Screen Studio instead when the team is on macOS and the priority is exceptionally polished screen-only demos.

## Video and campaign measurement

For every campaign, track:

- source, campaign and creative using UTM parameters;
- landing-page view to organiser signup;
- organiser signup to competition creation;
- competition creation to published registration;
- published registration to first application;
- cost per activated organiser;
- video hook rate, 25% completion and CTA click rate;
- percentage of organisers who publish a second competition or season.

The primary success metric should be **cost per organiser who publishes a registration and receives a first application**, not cost per click or total video views. This keeps promotion aligned with the product's real growth loop.

## AI-only video production

The video can be produced without filming a person or manually editing every scene. There are three practical levels of automation.

### Option A: fully generative advertisement

Generate the concept, scenes, voiceover, music and captions from a script or prompt. This works well for an emotional or metaphorical ad, for example:

- a chaotic stream of WhatsApp messages and spreadsheets transforms into one organised competition dashboard;
- animated teams move into a tournament bracket;
- an AI presenter explains the benefit in Czech, Slovak or German;
- the final scene shows the ATM logo and a call to action.

This approach is fast and visually flexible, but the generated ATM interface should not be presented as an exact product screen. Generative video models can invent labels, alter numbers or change the layout between shots.

### Option B: AI animation from real ATM screenshots

Export a few clean screenshots from the real application and use them as visual references. AI can then:

- animate a cursor or transition between screens;
- create zooms and camera movement;
- place the screenshots into a phone, laptop or browser scene;
- generate a voiceover, avatar, subtitles and background music;
- produce multiple language versions.

This is a better compromise for marketing because the main UI remains recognisable. The final video should still be checked frame by frame, particularly where AI has animated or transformed text.

### Option C: AI-assisted real product demo

Record the actual workflow once, then let AI create the script, remove pauses, generate the voiceover, add captions, translate the narration and make cutdowns. This is not technically 100% AI-generated, but it is the safest option when the video must accurately demonstrate registration settings, application statuses and approval actions.

For ATM, the recommended order is:

1. Use Option A for a short awareness ad.
2. Use Option B for a branded landing-page animation.
3. Use Option C for the main product demo and onboarding video.

### AI-focused service choices

- **HeyGen:** useful for an AI presenter, voiceover, translations and product-demo scenes. Its AI Studio can also turn a screen recording into an editable scene, but that part still uses a real recording. See the [HeyGen AI Screen Recorder](https://help.heygen.com/en/articles/14251628-how-to-use-screen-recorder).
- **Synthesia:** useful for presenter-led business videos, multilingual scripts and AI screen-recording workflows. Its recorder can split a real screen recording into scenes and transcribe the voiceover. See the [Synthesia AI screen recorder documentation](https://docs.synthesia.io/docs/record).
- **Runway:** useful for short generative or image-to-video scenes, transitions and visual metaphors. Its current Gen-4 workflow uses an input image and generates short 5- or 10-second clips, so a longer advertisement should be assembled from several checked scenes. See [Creating with Gen-4 Video](https://help.runwayml.com/hc/en-us/articles/37327109429011-Creating-with-Gen-4-Video).
- **Canva Magic Media:** useful for quick AI-generated visual inserts and branded assembly. Its official documentation currently describes text-to-video generation as short 4-second clips, so it is better suited to transitions, backgrounds and cutdowns than to a complete product demo. See [Canva Magic Media](https://www.canva.com/help/using-magic-media/).

### Proposed AI-only production recipe

**20-second awareness ad:**

1. Write a Czech script with three short scenes.
2. Generate an animated “manual chaos” opening in Runway or Canva Magic Media.
3. Generate a clean ATM-inspired visual using approved screenshots or UI mockups.
4. Generate a Czech voiceover and presenter in HeyGen or Synthesia.
5. Assemble the scenes, captions, logo and CTA in the same tool.
6. Review every frame for incorrect UI text, invented features and misleading claims.

**Important limitation:** do not let AI invent a workflow that ATM does not support. The advertisement should only show capabilities that are currently available, such as opening an application window, sharing a public form, reviewing applications and approving or waitlisting teams.
