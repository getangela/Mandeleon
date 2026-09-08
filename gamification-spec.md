# Mandeleon Gamification System — Design Spec

*Living reference document. Last updated: September 8, 2026.*

This document consolidates the full gamification design worked out in conversation: a personal virtual avatar users keep alive by engaging with real site content, and a parallel contributor rewards system for people who submit content. Nothing here is built yet — this is the design to build from once the backend (visitor accounts + database) is in place. See `todo.html` for how this fits into the overall site roadmap.

---

## 1. Core Concept: The Personal Avatar

Every visitor names and customizes a personal avatar that they keep healthy by "feeding" it real product, video, and article tiles from the site. This turns ordinary browsing into the core game loop — feeding isn't an abstract action, it's clicking into the same content the site already exists to showcase.

**The avatar has its own birthday, not the user's.** Early on we considered starting the avatar at the user's real chronological age, but rejected it: a leaderboard built on real age would always favor younger users regardless of how well anyone is actually optimizing, and it would require collecting real personal age data for no real benefit. Instead, the avatar's chronological clock starts the day it's created. Time is compressed so it reaches human-relatable numbers quickly — roughly **1 real day = 1 avatar "month"** — so the age-reversal concept feels meaningful within a few months of play, not years.

**Biological age vs. chronological age is the core metric**, mirroring real longevity science (the same concept behind epigenetic-clock products like TruAge or PhenoAge). The avatar's chronological age ticks up automatically over real time no matter what. Good feeding pushes its *biological* age below that; neglect lets the gap close or reverse. This is the number displayed most prominently, and it's what the leaderboard ranks on.

**The overall biological age is driven by the avatar's *weakest* meter, not an average.** This was a deliberate choice — averaging lets someone coast by over-feeding one favorite category while ignoring others, whereas a weakest-link model keeps every system relevant and mirrors how real health actually works (you're only as healthy as your most neglected system).

**What's now built (client-side, no backend needed):** the biological-vs-chronological age display on the avatar panel — the "number displayed most prominently" called for above. Chronological age is `(now − avatar.createdAt) / 1 day = 1 avatar month`, exactly as described above. Biological age applies the weakest meter's distance from 50 (the neutral value every avatar starts at) to scale chronological age up or down by up to **40% (`MAX_AGE_SWING`)** in either direction: weakest meter at 100 reads 40% younger than chronological age, weakest meter at 0 reads 40% older, and exactly 50 (or a freshly created avatar) shows the two matching exactly. This formula wasn't pinned down elsewhere in this doc before now — 40% was chosen as a swing big enough to feel meaningful without ever producing an absurd number (e.g. a 2-year-old avatar reading as "5 years old"). Shown as two stats side by side (biological larger/bolder, chronological smaller/secondary) plus a plain-language gap line ("2 yr 8 mo younger than chronological age"), color-coded green/red/neutral. Ages are formatted as months under a year, "Y yr M mo" after. Lives only in the full avatar panel for now, not the compact header strip — there wasn't room to add a third concept next to the existing Health/Pool pills and meters without crowding it.

---

## 2. Health Meters

Eight meters, each mapped to real site categories rather than invented from scratch:

| Meter | Maps to categories | Daily decay | First feed/day | Daily cap |
|---|---|---|---|---|
| Sleep & Stress | Sleep & Stress | −12 | +18 | 30 |
| Energy & Cellular Repair | Energy & Mitochondria, NAD, Senolytic | −10 | +16 | 27 |
| Brain | Cognitive & Nootropic | −8 | +14 | 24 |
| Gut & Liver | Gut/Liver | −8 | +14 | 24 |
| Heart | Cardio | −7 | +12 | 20 |
| Immune & Defense | Immune, Antioxidant | −6 | +10 | 17 |
| Muscle & Hormones | Muscle, Hormonal, Women's Health | −6 | +10 | 17 |
| Skin | Skin, Topicals | −5 | +8 | 14 |

**Design logic:** decay and recovery rates are paired intentionally — fast-changing real systems (sleep, energy) both fall and recover quickly, while slow-changing ones (skin) do both slowly. This mirrors real physiology and gives each meter a distinct feel rather than uniform math.

**Categories that don't map to a meter get special roles instead of being shoehorned in:**

- **Foundational** — acts as a small universal boost, nudging every meter up slightly (like a multivitamin), rather than belonging to one system.
- **Gadgets** — not "food." Using a gadget tile grants a temporary multiplier (e.g., a red-light session boosts the next Skin feed by 50% for 24 hours), reflecting that devices enhance rather than nourish.
- **Diet** (fasting protocols, etc.) — temporarily slows the decay rate across all meters for a day, rather than restoring points directly.
- **Age Testing** — acts as a "diagnostic scan," revealing precise current meter values (useful if a fog-of-war / estimate mechanic is ever added).
- **Cutting Edge** (articles/videos) — not a product, so it feeds a separate **Insight XP** track instead of a health meter, keeping knowledge progression distinct from physical health.
- **Exotics** — excluded from feeding **by default**, and never called "feeding" even once available. These are prescription/controlled-substance items; turning them into game "food" risks trivializing a genuine legal/medical gray area already flagged for lawyer review — the framing question is still open with counsel. What's now built: once an avatar reaches **Level 5 ("Captain")** on the Longevity Score track (Section 6), Exotics tiles become "Boost"-able — same underlying meter-gain mechanic as feeding, but deliberately kept off "feed"/"food" language in every button, toast, and label to reduce the trivialization concern while that legal question is unresolved. This is additive to, never a replacement for, the existing age/disclaimer gate required just to view Exotics at all. Full details and the per-item meter mapping are in Section 6.
- **Inspiration** — not a health-meter category. Instead, it runs through the same contributor system as other content (Section 9) — visitors can submit inspirational content the same way they'd submit a product, video, or article — but it earns a reduced **+1 point** per approval rather than the standard +5, reflecting that it's a lower-effort, lower-scarcity thing to source than a real recommendation.

---

## 3. Feeding Mechanics — Full Formula

Applied in order for every feed action:

1. **Base value** — from the table above, depending on which meter the tile maps to.
2. **Repeat-feed penalty** — based on how many times *this specific tile* has been fed *today*: 100% the 1st time, 50% the 2nd time, 15% the 3rd time and beyond. Prevents spam-clicking one tile.
3. **Discovery bonus (+50%, one-time only)** — applies the very first time a user ever feeds a specific tile, tracked per user like the existing saved-favorites feature. Rewards exploring the full catalog; naturally exhausts itself once someone's fed everything in a meter (a nice completionist milestone).
4. **Affiliate/vetted bonus (+20%, every time)** — applies whenever the tile is a real, vetted recommendation (`affiliate:true` in the existing data). Uses a field that already exists — zero new curation work. Not a claim about product effectiveness, just "this is one I stand behind."
5. **Perfect Feed (12% chance, ×1.5)** — a random bonus on *any* feed. Allowed to push that meter's total up to 20% past its normal daily cap for the day, so the jackpot always visibly moves the needle even near the cap. Always triggers a celebration (confetti, "Perfect Feed!" banner) regardless of how much the number itself moves — the excitement is part of the reward.

**Worked example:** feeding a brand-new, affiliate-linked Brain tile for the first time, with a lucky Perfect Feed roll: 14 (base) × 1.5 (discovery) × 1.2 (affiliate) × 1.5 (perfect) ≈ 38, clipped to Brain's overflow ceiling of 24 × 1.2 = **29** — still a big, satisfying jump.

**Cadence:** at 12% per feed, a typical day of ~6 feeds has just over a 50% chance of including at least one Perfect Feed — frequent enough to feel like a regular part of play, not a rare fluke.

**No purchase required.** The "Feed" action is separate from the affiliate "Visit" link, so playing the game never requires buying anything.

**Explicitly rejected: efficacy-based point values.** Early on we considered scaling feed value by how "effective" a supplement supposedly is. Rejected for three reasons: it edges toward a real efficacy claim (risky given FTC scrutiny of supplement marketing and the pending legal review of this site), it's a permanent curation burden across 100+ products, and it would funnel engagement toward a handful of "best" tiles — undermining the exact browse-broadly behavior the discovery bonus is designed to encourage.

---

## 4. Neglect & Recovery

Individual meters floor at 0 and use the red-to-green gradient described in UI Design below. Separately, the avatar has an **overall vitality state** based on the *average* of all eight meters (deliberately not the weakest meter, which only drives the daily biological-age number — one neglected category shouldn't be able to trigger a coma while the other seven are thriving):

| State | Average of all meters | Look | Countdown? |
|---|---|---|---|
| Thriving | ≥ 50 | Full color, vibrant, active idle animation | — |
| Struggling | 25–49 | Visibly aging — desaturating, slight stoop, duller idle animation. Warning shown. | No |
| Withering | < 25 | Fully dull, frail, idle rather than active | **Yes — 72-hour coma countdown starts** |
| Coma | Countdown reaches zero | Inert, grayscale, no idle animation | — |

**Countdown display:** a persistent, unmissable ticking badge on the avatar, styled distinctly (a more urgent red) from the routine per-meter warnings, so it reads as a real emergency rather than everyday clutter. Once real accounts/notifications exist, entering Withering is a strong natural trigger for a push/email alert.

**Escaping the countdown:** any normal feeding session that brings the average back above 25 cancels it immediately — no special action required, so a person who's just been busy for a few days isn't punished.

**Entering Coma:** meters stop decaying further once in Coma — no piling-on penalty for staying away longer after the worst has already happened. Normal feeding is disabled; a distinct **Revival** action is required instead (e.g., feed at least 4 different meters in one sitting). On success, the avatar wakes up at a low baseline (~20–25 per meter), not full health — real effort is needed afterward, but nothing is lost permanently.

**Deliberately no permadeath.** Coma is a floor, not a path to deletion or permanent loss. This is a wellness-brand site — a mechanic that could make someone feel they've permanently failed and lost their avatar would actively work against the retention goal this whole system exists for.

---

## 5. Avatar Visual Design — Full Body & Face Upload

**Decision: full body, not just a face.** The neglect mechanic in Section 4 needs real visual surface area to sell "looks older and more frail" — a face-only avatar can only shift an expression, while a full body can change posture, color, and detail. A user's own uploaded photo stays the one constant, personal element throughout; everything around it is what actually communicates current health state.

**Body art: a small set of inline SVG illustrations, not the photo itself.** One flat, simple character shape (rounded torso, arms, legs, a circular cutout where the head goes) is drawn directly in the page's SVG/CSS — no external image hosting, staying consistent with the single-file architecture. Rather than one static drawing, there's one SVG variant per vitality state already defined in Section 4's table, so the body IS the visual expression of that table rather than a separate system:

| Vitality state | Trigger (Section 4) | Body treatment |
|---|---|---|
| Peak | Every single meter maxed (100), not just a high average | Warm glow halo, flex-icon call-outs by the arms, brighter/more saturated color, quicker celebratory bounce |
| Thriving | Average of all meters ≥ 50 | Upright posture, full color saturation, small sparkle accents |
| Struggling | Average 25–49 | Slight stoop, desaturating color + a fading-in "worn uniform" grime texture, sparkle accents removed |
| Withering | Average < 25 | Pronounced slouch/frailty, heavily desaturated, dulled palette, heaviest worn-uniform texture |
| Coma | 72-hour countdown reaches zero (Section 4) | Lying-down pose, grayscale, no idle animation |

**Implementation note (what actually shipped vs. the plan above):** rather than a separate SVG per tier, the base art is a single licensed full-body illustration (arms already raised at ~45°) rendered once and re-styled per tier with CSS — `filter` (desaturation/sepia/saturation), a rotate/lean amount, and layered overlay elements (the worn-uniform texture, the Peak glow + flex icons, the Thriving sparkles). This gets most of the same expressive range — color, posture lean, decorative accents — without needing a full second art asset per state; a genuinely different pose (e.g., arms fully re-drawn into a flex rather than a decorative 💪 call-out layered on top) would need new artwork in the same style, which hasn't been commissioned. The whole avatar also runs a continuous subtle "idle breathing" animation (a gentle bob/scale) whenever it's on screen — in the full avatar panel and, more subtly, in the persistent header strip's thumbnail — paced faster while Peak/Thriving and slower/heavier while Withering, so it reads as alive rather than a static sticker. Coma is not yet built (see the "Only the first three tiers are wired up" note wherever `getAvatarVitalityTier()` is defined in the code).

**Face upload: user-adjustable crop, then compressed and stored client-side.** An optional photo upload — available on the avatar naming screen, inside the combined email-gate's avatar fields, and via the "change photo" button on an existing avatar — opens a crop modal before anything is saved: the photo sits behind a fixed circular viewport that the visitor can drag to pan and use a slider to zoom (1x–3x), so they can actually center their face rather than getting an automatic, non-adjustable center-square crop. Confirming ("Use Photo") bakes the current pan/zoom into a canvas step in the browser — downscale to 200×200, re-compress as a JPEG — before storing it as a base64 data URL on the avatar record in localStorage, the same persistence pattern already used for saved favorites. Keeping the file small matters because localStorage has a practical few-MB ceiling shared with everything else the site stores there. Canceling the crop modal leaves whatever photo (or placeholder) was already in place untouched. If no photo is ever uploaded, a simple default face placeholder fills the same slot so the avatar still renders correctly.

**Aging effects apply live and non-destructively.** The uploaded photo is never altered or re-saved — a CSS filter (desaturation, brightness) is applied to it at render time based on the *current* vitality state, layered together with whichever body SVG is showing. This means reviving a neglected avatar snaps the whole look back to vivid immediately, with nothing lost or needing to be re-uploaded, consistent with the "no permadeath" principle in Section 4.

**Gender: one universal, gender-neutral body for now.** Rather than building separate male/female body sets (doubling or tripling the art needed per vitality tier before the base system has even shipped, and forcing a binary category that not everyone fits), Phase 1 ships with a single neutral silhouette. Multiple body styles/silhouettes as a personalization option is a natural future enhancement — either offered free at avatar creation alongside the name, or added as a Level-based cosmetic unlock alongside the existing color-palette and accessory-slot progression in Section 6 — worth revisiting once the base system is live and there's real usage to inform whether people actually want it.

**Future consideration, not a Phase 1 blocker:** this works entirely client-side today because only the avatar's own owner ever sees their photo. Once the Cohort Pools leaderboard or public contributor profiles exist and other users can see each other's avatars, face images need to move from localStorage into real backend file storage, which in turn raises a content-moderation question that doesn't exist yet (someone uploading an inappropriate image). Flagged here for the Foundation phase in Section 11, not something to solve now.

---

## 6. Leveling & Cosmetic Unlocks (Sustained Care)

A separate, permanent accomplishment track — distinct from the day-to-day health meters and from the contributor tiers below. This rewards long-term dedication to the avatar itself, independent of whether someone ever contributes content.

**Longevity Score** — never decreases, unlike the meters. +1 point for every day the avatar ends in the Thriving state (meter average ≥ 50). +3 instead on a "Radiant" day, where *every* individual meter is at 70+ (rewards genuine all-around care, not a good average propped up by a couple of maxed favorites).

**Streak counter** — a visible, Duolingo-style flame tracking consecutive Thriving days, shown alongside Longevity Score. Deliberately kept separate from what actually unlocks levels: breaking a long streak already stings on its own, and pure streak-gated rewards risk making people give up entirely after a bad week rather than start over. Streak milestones still grant one-time Longevity Score bonuses: +10 at 7 days, +25 at 30 days, +100 at 100 days.

**Levels** (permanent once reached, survive any later neglect):

| Level | Longevity Score | Title | Unlocks |
|---|---|---|---|
| 1 | 0 | Recruit | Starting appearance |
| 2 | 10 | Cadet | Second color palette option |
| 3 | 30 | Private | First accessory slot (glasses, small hat) |
| 4 | 75 | Sergeant | Second accessory slot + unique idle animation |
| 5 | 150 | Captain | Soft sparkle effect during Thriving |
| 6 | 300 | Major | Exclusive profile backdrop |
| 7 | 500 | Colonel | Public title tag (e.g. "Old Soul, Young Cells") |
| 8 | 1000 | Five-Star General | Rarest avatar-care cosmetic on the platform — a radiant "youth aura" |

This top cosmetic is intentionally distinct from the fractal-glow effect reserved for Master Contributors (Section 9) — sustained self-care and contributing content are different accomplishments and each should have its own unmistakable visual reward, rather than sharing one.

**Exotics Boost unlock.** Level 5 ("Captain," Longevity Score 150) is also the gate for the one gameplay mechanic built on this track so far: Exotics tiles (excluded from feeding by default — see Section 2) become interactive once an avatar reaches it. Reasoning for that specific level: Level 3–4 (30–75) are reachable within a few weeks and don't demonstrate much beyond a couple of visits; Level 5 realistically takes a few months of consistent, genuine care, which is the right bar for something legally sensitive. Level 8 (1000, "Five-Star General") stays reserved as the platform's single rarest cosmetic and is deliberately *not* reused as a content gate. This is additive on top of, never a replacement for, the existing age/disclaimer gate already required just to view Exotics at all.

Because the framing question with counsel (see Section 2) is still open, the unlocked interaction is never labeled "Feed" for Exotics — every button, toast, and label instead says **"Boost"** (e.g. "⚡ Boost {avatar name}", "⚡ Boost: +12 Brain", "✨ Perfect Boost!"), and the tile's accent color shifts to the same purple used elsewhere for Exotics rather than the standard feed color. A visitor below Level 5 sees a locked hint instead of a working button/pill ("🔒 Boosting unlocks at Level 5: Captain (Longevity Score 150). You're currently Level {N}: {title} (Longevity Score {score}).") rather than the option silently not existing, so the milestone is something to visibly work toward. Level/title pairs are always written as "Level N: Title" (colon, not a dash) everywhere in the UI and docs.

Each Exotics item boosts one meter, chosen for thematic fit with what it actually is rather than a flat across-the-board bonus:

| Item | Meter |
|---|---|
| Selegiline, Piracetam, Serotonin Support, Psychotropic Support | Brain |
| Tretinoin Cream, Bimatoprost, Minoxidil, Placenta Cream | Skin |
| Tadalafil | Heart |
| HRT (Men), HRT (Women), Estriol Cream | Muscle & Hormones |
| Metformin, Canagliflozin | Gut & Liver |
| Peptides | Energy & Cellular Repair |

---

## 7. UI Design

**Health meters:** horizontal bars, one per meter, each with a label and small icon (echoing icons already used per-category on the site). Fill color uses a **smooth gradient from red through yellow to green** (computed continuously, not hard-cutoff zones) so a bar reads as "getting worse" well before hitting a danger threshold. Paired with a short text state label ("Critical," "Okay," "Thriving") alongside every bar — color alone is an accessibility gap for colorblind users, and the site's brand red is already used elsewhere, so the warning state needs to read clearly as a warning on its own. Bars animate smoothly (with a little glow) when a feed lands, since that instant feedback is a big part of what makes the system feel satisfying rather than like a checklist.

**Combined avatar-creation + email gate:** a first-time visitor's very first tile click no longer shows a bare email-capture form — it opens one combined "Create Your Avatar" form asking for an avatar name, an optional photo, and email together, in a single submit. The same gate adapts to what a given visitor is still missing rather than always asking for both: a visitor who unlocked email before this feature existed but has no avatar yet only sees the avatar fields; one who somehow has an avatar but never unlocked email only sees the email field. Exotics stays double-gated behind this the same as before — the combined gate first, then the 18+/disclaimer notice. The avatar can still also be created the original way, via the profile icon, for a visitor who never happens to trigger the gate.

**Persistent avatar strip:** once an avatar exists, a compact strip — small circular face thumbnail, name, and all 8 meters as mini bars — is docked in the sticky header between the topbar and the category pills, so it's visible while scrolling horizontally through the pills or vertically down the grid. Clicking it opens the full avatar panel. It stays in sync with every meter change (feeding, decay) and every avatar-photo change, from either creation path.

**Health status + Cohort Pool status, surfaced live:** both the persistent strip and the full avatar panel show two small color-coded pills — "Health" and "Pool." The Pool pill uses the Cohort Pool tier names directly from Section 8 (Elite/Optimal/Normal/Critical). The Health pill is a battery/charge-themed **display label** over the same internal vitality tier from Section 4/5 — Peak/Thriving/Struggling/Withering underneath, shown to visitors as Supercharged/Energized/Recharging/Depleted — the same "rename the label, not the underlying mechanic" approach already used for Care Score → Longevity Score elsewhere in this doc, so `getAvatarVitalityTier()`, `BODY_TIER_STYLE`, and the rest of Sections 4–8's vocabulary are unaffected. The avatar illustration's aria-label (for screen readers) uses the same battery wording so assistive tech announces the same word a sighted visitor sees in the pill. The Pool pill is a genuine preview of the not-yet-built weekly leaderboard — it's computed the same way the leaderboard eventually would (Elite = every meter at 70+, same threshold as a Radiant day; Optimal/Normal/Critical off the meter average) but entirely client-side from the avatar's own current meters, so it needed no backend to ship even though the leaderboard itself does. On the header strip, the Pool pill is hidden on narrow/mobile screens to save space (the strip's name label already does the same); the full panel always shows both, spelled out with "Health:"/"Pool:" labels.

**Polish items (not v1, tracked on `todo.html`):**
- A subtle fractal-textured glow around the avatar when most meters are green — a full-circle brand moment (ties to the Mandelbrot fractal logo exploration).
- The Perfect Feed confetti/banner celebration.

---

## 8. Global Leaderboard

**Rejected approaches and why:**
- *Real chronological age as the base* — unfair; younger users would always show lower absolute numbers regardless of effort.
- *Same fixed starting age, ranked by lifetime cumulative gain* — unfair in a different way; long-tenured users would dominate forever and new users could never catch up.

**Chosen approach: Cohort Pools.** Rather than one flat board, avatars are grouped into pools based on their *current* health state — so a new or recovering user is never competing against a long-established veteran. A vital-signs-style status scale, opening with "Critical" — the same per-meter state label already used on the health bars themselves (Section 7) — rather than introducing a competing naming scheme against the bronze/silver/gold contributor tiers:

| Pool | Who's in it |
|---|---|
| Critical | Avatars currently in Coma or Withering |
| Normal | Avatars in Struggling |
| Optimal | Avatars in the Thriving range |
| Elite | Avatars hitting Radiant-level care (every meter at 70+) |

**How it works:** pool placement locks at the start of each week based on the avatar's state at that moment (Duolingo-style — no mid-week pool-hopping off a single good or bad day). Within a pool, ranking is by **how much the biological-age gap improved that week**, not absolute standing — so a Critical Pool avatar can genuinely win its bracket through a strong comeback week, and the Elite Pool stays competitive since existing top performers can't just coast on old standing.

**Promotion/demotion:** the top ~15–20% of each pool promotes up a pool at week's end; the bottom ~15–20% demotes down. Elite has nowhere higher to promote to — top finishers there earn a "Pool Champion" badge for the week instead. Critical has nowhere lower to demote to — bottom finishers there get an encouraging nudge, never a penalty, consistent with the no-punishment stance already established for neglect (Section 4).

**All-time board, separate:** the permanent Longevity Score from the leveling system (Section 6) powers its own ungrouped, all-time leaderboard for long-term bragging rights — a different metric doing a different job than the weekly Cohort Pools.

**Privacy:** leaderboard visibility (both Cohort Pools and the all-time board) should be **opt-in**, and should always display the user's chosen avatar name, never a real identity — ranking people's health, even fictionalized, can feel invasive if it's not something they chose to share.

---

## 9. Contributor Rewards System

Ties directly into the existing (not-yet-built) "Contribute" flow, admin dashboard, and visitor-accounts items already on `todo.html` — this isn't a fourth separate system, it's the same backend serving multiple features.

### Points

**Flat +5 points for any approved submission** — product, video, article, Cutting Edge content, or a correction to something existing. (Earlier drafts varied the value by content type and effort, up to +15 for Cutting Edge, but this was simplified to one flat number. A one-time "gap-filling" bonus for being first to submit into an empty category was also considered and dropped.)

**One exception: Inspiration content earns +1**, not +5 — it's a much lower-effort, lower-scarcity submission than a real product, video, or article recommendation, so the reward scales down with it. Everything else about the flow is identical: same submission form pattern, same Pending state, same reviewer actions, same public attribution on approval. Inspiration content is also, by its nature, essentially never Exotics/medical-adjacent, so it will almost always route through the normal tier-based queue rather than the mandatory-full-review path.

### Tiers

Four tiers, colored like a medal ladder so status reads at a glance:

| Tier | Points | Submissions (at flat +5) | Color | Unlocks |
|---|---|---|---|---|
| Contributor | 0–24 | 0–4 | Bronze | Public "Contributor" badge; small avatar cosmetic |
| Verified Contributor | 25–74 | 5–14 | Silver | Submissions jump to front of review queue; distinct avatar title/name-tag styling |
| Trusted Researcher | 75–199 | 15–39 | Gold | **Auto-publish** for ordinary (non-Exotics, non-medical) content; visibility on a "Top Contributors" leaderboard |
| Master Contributor / Longevity Fellow | 200+ | 40+ | Platinum (shifting/prismatic shimmer) | Featured on a Hall of Fame / credits page; the single most exclusive avatar cosmetic — this is the natural home for the fractal-glow effect |

Points do **not decay** — unlike health meters, contributor reputation reflects lifetime trust earned, not ongoing maintenance.

**Hard guardrail, no exceptions by tier:** any submission touching Exotics or medical/prescription-adjacent content always requires full human review, regardless of the submitter's tier. If an auto-published item from a Trusted Researcher+ is later flagged, it's pulled immediately and that person's auto-publish privilege goes on probation pending a review of their recent history.

### Duplicate-submission prevention

- **At submission time:** real-time check as a URL is entered, normalized first (strip tracking params, treat `youtu.be/x` and `youtube.com/watch?v=x` as identical, ignore `www.`/`http` vs `https`) and compared against both published content and pending submissions. A match warns the user immediately, before they finish the form.
- **Soft duplicate flag:** for products specifically, a fuzzy name-similarity check flags possible duplicates for reviewer attention without hard-blocking, since similar names don't always mean identical content.
- **At review time:** the queue visually flags pending submissions that match each other (race-condition case — two people submitting nearly simultaneously). The reviewer approves one and rejects the other using the existing "Duplicate content" rejection reason, linking to the item that's going live.

### Submission & review flow

1. **Submit** — logged-in user fills a form (fields vary by content type: product/video/article/correction). Submission enters a "Pending" state, invisible on the live site but visible to the submitter in a "My Submissions" tracker.
2. **Route** — Exotics/medical content → always full manual review. Contributor/Verified Contributor → standard queue (Verified jumps the line). Trusted Researcher+ on ordinary content → auto-publish, flagged internally as unreviewed for spot-checking.
3. **Review** (for anything manual) — reviewer sees the submission, a live tile preview, and the submitter's tier/history inside a "Pending Submissions" tab in the admin dashboard. Three outcomes: **Approve** (publishes, awards points, notifies submitter), **Reject** (with a specific reason — broken link, needs sourcing, wrong category, duplicate, doesn't fit the site), or **Request Revision** (specific feedback, submitter can edit and resubmit without losing their place).
4. **Publish + attribute** — approved content goes live immediately with public "submitted by [name]" credit on the tile — a strong intrinsic motivator on its own.
5. **Post-publish safety net** — any visitor can flag a published tile. Enough flags, or *any* flag on an auto-published item, pulls it back into the manual queue immediately.

---

## 10. Public Contributor Profile

- **Avatar front and center** — the same avatar from the health game, including unlocked contributor cosmetics (the platinum/fractal effect for Master Contributors).
- **Chosen display name**, not necessarily a real identity — same pseudonymous approach as the avatar itself, important given some contributed content touches Exotics-adjacent territory.
- **Bronze→silver→gold→platinum progress bar** — one continuous bar with color blending smoothly across tier boundaries, zones labeled by tier name/threshold. Since Master Contributor is open-ended (200+), the bar caps visually and an exact point number is shown alongside it instead.
- **Total approved contributions**, shown positively. Deliberately **no rejection rate or approval percentage** shown publicly — that would just discourage newer contributors from taking chances, without giving anyone else useful information.
- **Portfolio gallery** of their approved tiles, reusing the existing pin-card rendering filtered to "submitted by this person" — turns the profile into a real portfolio, not just a stats sheet.
- **"Known for" specialty tags** for prolific contributors (e.g., "Cutting Edge, Cognitive & Nootropic") — a nice side effect: this doubles as genuine E-E-A-T credibility content for SEO, already a separate item on `todo.html`.
- **Leaderboard rank**, shown if the user has opted in.
- **Lightweight "kudos" button** (borrowed from Strava) — a simple way for other visitors to acknowledge a contributor's work without needing a full comment system, which would be a much bigger moderation burden given the site's content.

---

## 11. Build Sequencing & Dependencies

**Phase 1 — Single-device avatar MVP (buildable now, no backend needed).** Everything in Sections 1–7 — health meters, the full feeding formula, meter-bar UI, Neglect & Recovery, the full-body/face-upload visual system, Leveling & Longevity Score — can run entirely in the browser via localStorage, the same pattern already powering the live Save/favorites feature. Nothing here is blocked by anything else. Worth building first regardless of what comes next, since it validates real engagement before any backend investment. Design the localStorage data model with the eventual database schema in mind, so the next phase is a migration, not a rewrite.

**Foundation (blocks everything past Phase 1) — visitor accounts + database.** Already planned separately on `todo.html` (Netlify Database/Neon + Functions + Identity). Nothing below this line can work without it, since every remaining piece involves seeing other users' data.

Once the Foundation exists, two tracks open up that don't depend on each other and can be built in either order or in parallel:

- **Track A — cross-device avatar + Cohort Pools leaderboard.** Avatar state moves from localStorage into the database so it follows a user across devices. This also unlocks the Cohort Pools leaderboard (Section 8) — the first piece of this whole system that genuinely requires seeing everyone's data at once. Face-upload images also move from localStorage into real backend file storage here, which is when a content-moderation step needs to exist (see Section 5). **Global avatar-name uniqueness also belongs here**: Phase 1 has no shared backend, so an avatar name can't actually be checked against every other visitor's name yet — the naming form takes whatever is typed with no collision check. Once the database exists, add a uniqueness check against all stored avatar names at creation time (case-insensitive match recommended), with a clear inline error and a re-prompt if the chosen name is taken.
- **Track B — Contributor Rewards System.** Has its own additional prerequisite beyond accounts: the "Contribute" flow and admin dashboard, both separate bigger projects already on `todo.html`. Once basic submission-and-review infrastructure exists, points/tiers (Section 9), duplicate-submission prevention, and the public contributor profile (Section 10) layer on top — the profile naturally can't exist before the Phase 1 avatar does, since it reuses it.

**Last — polish pass**, whenever core mechanics are stable: the fractal-glow effect and Perfect Feed confetti already flagged as deferred on `todo.html`, plus any further cosmetic refinement informed by real usage.
