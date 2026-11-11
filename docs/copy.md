# ATTICUS — Phase 1 Copy & Disclaimers

**Task:** PO-1 · **Status:** APPROVED by Mat (2026-11-12)
**Sources checked:** `supabase/migrations/20261112000000_phase1_core.sql` (heart_disease preset, `log_dose`, `set_pet_memorial`, medication refill fields)

## Writing rules (apply to every string below)

- Plain, calm, neutral. Short sentences. Grade 6 reading level.
- ATTICUS records and organizes. It never diagnoses, never says what is "normal", never suggests a dose.
- Threshold items are **questions to ask the vet**. No example numbers. No "normal range" wording.
- The only action we ever suggest is **"call your vet."**
- `{pet}`, `{name}`, `{time}`, `{count}`, `{med}` are placeholders filled in by the app.
- Filipino (FIL) is optional. Have a native speaker review it before release.

---

## 1. Onboarding disclaimer

Shown once on first launch. The person must tap "I understand" to continue. Also reachable later in Settings > About.

**EN**

> **Before you start**
>
> ATTICUS helps you keep track of {pet}'s care. You can log medicine, meals, and signs you notice. You can share them with your family and your vet.
>
> ATTICUS is **not** a medical app. It does not diagnose. It does not give medical advice. It does not tell you how much medicine to give.
>
> Any number you enter, like a medicine amount or a breathing rate to watch, should come from your licensed vet.
>
> If you are worried about {pet}, call your vet.
>
> [I understand]

**FIL**

> **Bago magsimula**
>
> Tinutulungan ka ng ATTICUS na itala ang pag-aalaga kay {pet}. Maaari mong itala ang gamot, pagkain, at mga napansin mo. Maaari mo itong ibahagi sa pamilya at sa beterinaryo mo.
>
> Ang ATTICUS ay **hindi** medikal na app. Hindi ito nagsusuri ng sakit. Hindi ito nagbibigay ng payong medikal. Hindi nito sinasabi kung gaano karaming gamot ang ibibigay.
>
> Ang anumang numerong ilalagay mo, tulad ng dami ng gamot o bilang ng paghinga na babantayan, ay dapat galing sa lisensyadong beterinaryo mo.
>
> Kung nag-aalala ka kay {pet}, tawagan ang beterinaryo mo.
>
> [Naiintindihan ko]

**Short footer line** (bottom of the Command Center and on every exported vet report)

- EN: ATTICUS is a record-keeping tool. It is not medical advice. Follow your licensed vet.
- FIL: Ang ATTICUS ay talaan lamang. Hindi ito payong medikal. Sundin ang lisensyadong beterinaryo mo.

---

## 2. App Store and Play Store listing

### App name and subtitle

- **Name:** ATTICUS
- **Subtitle / short tagline (max 30 chars, App Store):** Pet care log for your family
- **Play Store short description (max 80 chars):** Log your pet's medicine, meals, and signs. Share with family and your vet.

### Long description (EN)

> **Keep your pet's care in one calm place.**
>
> ATTICUS is a care log for pets with a long-term health need. It starts with heart disease. It helps your whole household stay on the same page.
>
> **What you can do**
> - Log each medicine dose and see who gave it and when.
> - Get a gentle warning if a dose may have been logged twice.
> - See what is coming up next: the next medicine, the next meal.
> - Keep track of how many pills are left, and get a reminder before they run out.
> - Log signs you notice, like coughing, restlessness, appetite, pee, and poop.
> - Use the breath counter to count resting breaths.
> - Save a short video when something urgent happens, so you can show your vet.
> - Share care with family, caregivers, and sitters. Each person gets the access you choose.
> - Make a one-page report to bring to your vet.
> - Keep {pet}'s memories and records in memorial mode when the time comes.
>
> **What ATTICUS is not**
> ATTICUS is not a medical app. It does not diagnose, treat, or give medical advice. It does not tell you what dose to give or what a number means. Every medical number in the app comes from you, as told to you by your licensed vet.
>
> If you are worried about your pet, call your vet.
>
> **Your pet's records belong to you.** Your household decides who can see them.

*(Replace "{pet}'s" with "your pet's" in the store version.)*

### Long description (FIL, optional)

> **Isang tahimik na lugar para sa pag-aalaga ng alaga mo.**
>
> Ang ATTICUS ay talaan ng pag-aalaga para sa mga alagang may pangmatagalang karamdaman. Sa simula, para ito sa sakit sa puso. Tinutulungan nito ang buong sambahayan na magkasundo sa pag-aalaga.
>
> **Ano ang magagawa mo**
> - Itala ang bawat dose ng gamot at tingnan kung sino ang nagbigay at kailan.
> - Makatanggap ng mahinahong paalala kung baka dalawang beses naitala ang isang dose.
> - Makita ang susunod na gamot at susunod na kain.
> - Bilangin ang natitirang gamot at makatanggap ng paalala bago maubos.
> - Itala ang mga napapansin mo, tulad ng ubo, hindi mapakali, gana sa pagkain, ihi, at dumi.
> - Gamitin ang breath counter para bilangin ang paghinga habang nagpapahinga.
> - Mag-save ng maikling video kapag may nangyaring mabigat, para maipakita sa beterinaryo.
> - Ibahagi ang pag-aalaga sa pamilya, tagapag-alaga, at sitter.
> - Gumawa ng isang pahinang ulat na dadalhin sa beterinaryo.
> - Itago ang mga alaala at talaan ng alaga sa memorial mode kapag dumating ang oras.
>
> **Ano ang hindi ATTICUS**
> Ang ATTICUS ay hindi medikal na app. Hindi ito nagsusuri, hindi gumagamot, at hindi nagbibigay ng payong medikal. Hindi nito sinasabi kung anong dose ang ibibigay o kung ano ang ibig sabihin ng isang numero. Lahat ng medikal na numero sa app ay galing sa iyo, ayon sa sinabi ng lisensyadong beterinaryo mo.
>
> Kung nag-aalala ka sa alaga mo, tawagan ang beterinaryo mo.

### Store keywords / category notes

- Category: **Lifestyle** (App Store), **Pets** or **Lifestyle** (Play). Do **not** use "Medical" or "Health & Fitness".
- Avoid in all listing text and screenshots: *diagnose, detect, monitor your pet's health, normal, abnormal, safe range, dosage calculator, treat, cure, alert for danger.*
- Screenshots must not show real-looking clinical numbers next to words like "good" or "bad".

---

## 3. Heart disease preset: labels and threshold questions

Source: `condition_presets` row `heart_disease`, version 1.

### 3a. Preset name

| In database | Friendly label (EN) | FIL |
|---|---|---|
| Heart Disease | Heart care | Pangangalaga sa puso |

Helper line under the name — EN: *Log the things your vet asked you to watch.* FIL: *Itala ang mga pinababantayan ng beterinaryo mo.*

### 3b. Quick logs

| `kind` | Database label | Friendly label (EN) | Helper text (EN) | FIL label |
|---|---|---|---|---|
| `rrr` | Resting breathing rate | Resting breaths | Count breaths while {pet} is resting. | Paghinga habang nagpapahinga |
| `cough` | Coughing | Coughing | What did the cough sound like? | Ubo |
| `restlessness` | Restless / pacing | Restless or pacing | How restless was {pet}? | Hindi mapakali / paikot-ikot |
| `pee` | Pee | Pee | Tap each time {pet} pees. | Ihi |
| `poop` | Poop | Poop | Pick the picture that looks closest. | Dumi |
| `appetite` | Appetite & mood | Appetite and mood | How did {pet} eat and act today? | Gana sa pagkain at mood |

**Cough choices** (`options`)

| Database | EN | FIL |
|---|---|---|
| Soft | Soft | Mahina |
| Honking | Honking | Parang busina |
| Wet | Wet | Basa |
| Dry | Dry | Tuyo |
| Coughing fit | A coughing fit | Sunod-sunod na ubo |

**Restlessness scale** (`0-3`)

| Value | EN | FIL |
|---|---|---|
| 0 | Not restless | Hindi mapakali |
| 1 | A little | Kaunti |
| 2 | Quite a bit | Medyo marami |
| 3 | Very restless | Sobrang hindi mapakali |

**Appetite and mood scale** (`0-3`)

| Value | EN | FIL |
|---|---|---|
| 0 | Not interested in food | Walang gana |
| 1 | Ate a little | Kaunti ang kinain |
| 2 | Ate most of it | Halos naubos |
| 3 | Ate it all | Naubos lahat |

Optional mood note field — EN: *Anything else about how {pet} seemed?* FIL: *May iba pa bang napansin kay {pet}?*

**Poop picture scale:** show pictures only, no words that say good or bad. Caption under pictures — EN: *Pick the closest picture. Your vet can help you read it.* FIL: *Piliin ang pinakamalapit na larawan. Matutulungan ka ng beterinaryo mo na intindihin ito.*

### 3c. Urgent logs

| `kind` | Database label | Friendly label (EN) | FIL |
|---|---|---|---|
| `collapse` | Collapse / fainting | Collapse or fainting | Pagbagsak o pagkawala ng malay |
| `breathing_distress` | Breathing difficulty | Trouble breathing | Hirap sa paghinga |

Screen text after the person opens an urgent log:

- EN: **Call your vet.** You can save a short video to show them. Tap record when you are ready.
- FIL: **Tawagan ang beterinaryo mo.** Maaari kang mag-save ng maikling video para maipakita sa kanila. Pindutin ang record kapag handa ka na.

Button labels — EN: *Record video* · *Save without video* · *Call my vet*. FIL: *Mag-record ng video* · *I-save nang walang video* · *Tawagan ang beterinaryo*.

### 3d. Tool: breath counter

- Name — EN: Breath counter. FIL: Pambilang ng hininga.
- Intro (first use) — EN: *Watch {pet}'s chest while {pet} rests. Tap each time the chest rises. Ask your vet how long to count and when to count.* FIL: *Tingnan ang dibdib ni {pet} habang nagpapahinga. Pindutin sa bawat pagtaas ng dibdib. Itanong sa beterinaryo kung gaano katagal at kailan magbibilang.*
- Result line — EN: *Saved: {count} breaths per minute.* FIL: *Na-save: {count} hininga kada minuto.*
- The app shows the number it counted and **nothing else**. No colors that mean good or bad, no words like "high" or "normal".

### 3e. Threshold question (`threshold_prompts`)

The database question is: *"At what resting breathing rate (while asleep) did your vet tell you to call them?"* Keep it as a question the person answers from what the vet said. The friendly version:

**Setup screen — "Ask your vet"**

- Title — EN: *Ask your vet* FIL: *Itanong sa beterinaryo*
- Question — EN: **At what resting breathing rate, while {pet} is asleep, did your vet tell you to call them?** FIL: **Sa anong bilang ng paghinga, habang natutulog si {pet}, sinabi ng beterinaryo mo na tawagan sila?**
- Helper — EN: *Type exactly what your vet told you. ATTICUS does not pick this number for you.* FIL: *I-type nang eksakto ang sinabi ng beterinaryo mo. Hindi pumipili ng numero ang ATTICUS para sa iyo.*
- Field label — EN: *Number from my vet* · *Unit: breaths per minute* · *My vet's words (optional)* FIL: *Numero mula sa beterinaryo ko* · *Yunit: hininga kada minuto* · *Mga salita ng beterinaryo ko (opsyonal)*
- Buttons — EN: *Save* · *I don't know yet* FIL: *I-save* · *Hindi ko pa alam*

**If the person taps "I don't know yet" (empty state)**

- EN: *No number saved yet. This is a good question to ask at your next vet visit. Until then, ATTICUS will just record the breaths you count.*
- FIL: *Wala pang naka-save na numero. Magandang itanong ito sa susunod na punta mo sa beterinaryo. Hanggang doon, itatala lang ng ATTICUS ang mga hininga na binilang mo.*

**When a saved number is passed** (only if the person saved a vet number)

- EN: **This is the number your vet gave you. Call your vet.** FIL: **Ito ang numerong ibinigay ng beterinaryo mo. Tawagan ang beterinaryo mo.**
- Shown beside the saved vet words, if any: *Your vet said: "{vet_instruction}"*
- Do not add any other advice, color-coded warning, or comparison to other pets.

**Edit / change** — EN: *Did your vet give you a new number? Update it here.* FIL: *Nagbigay ba ng bagong numero ang beterinaryo mo? I-update dito.*

*Future presets (CKD, diabetes, epilepsy, cancer, arthritis) are not available yet. Their questions will follow the same pattern and need their own review.*

---

## 4. Empty states and errors

### 4a. Duplicate-dose warning

Triggered when `log_dose` returns `needs_confirmation`. Shows who and when from the `conflict` data.

**Warning dialog**

- Title — EN: **This dose may already be logged** FIL: **Baka naitala na ang dose na ito**
- Body — EN: *{name} logged {med} at {time}. Did {pet} get a second dose, or is this the same one?* FIL: *Naitala ni {name} ang {med} nang {time}. Pangalawang dose ba ito, o iyon pa rin?*
- If name is unknown — EN: *Someone in your household logged {med} at {time}. …* FIL: *May miyembro ng sambahayan na nagtala ng {med} nang {time}. …*
- Buttons — EN: *That's the same dose* (cancel, nothing new saved) · *This is a different dose* (log anyway) FIL: *Iyon din ang dose* · *Ibang dose ito*
- Extra line, shown always — EN: *Not sure? Call your vet.* FIL: *Hindi sigurado? Tawagan ang beterinaryo mo.*

**Confirmation after "same dose"** — EN: *Okay. Nothing was added.* FIL: *Sige. Walang idinagdag.*

**Settings label for the warning window** (`duplicate_warning_minutes`) — EN: *Warn me if another dose is logged within this many minutes* · helper: *Ask your vet if you are not sure what to choose.* FIL: *Balaan ako kung may isa pang dose na naitala sa loob ng ilang minuto* · *Itanong sa beterinaryo kung hindi ka sigurado.*

**Errors**

| Situation | EN | FIL |
|---|---|---|
| Saving failed (no internet) | *We could not save this dose yet. It is saved on your phone and will send when you are back online.* | *Hindi pa ma-save ang dose na ito. Nakatago ito sa telepono mo at ipapadala kapag may internet na.* |
| Dose already saved (same tap twice) | *This dose is already saved.* | *Na-save na ang dose na ito.* |
| Not allowed (view-only role) | *Your role can't log doses. Ask the person who owns this pet's account.* | *Hindi puwedeng magtala ng dose ang role mo. Magtanong sa may-ari ng account.* |
| Medicine not found | *We could not find this medicine. Go back and try again.* | *Hindi makita ang gamot na ito. Bumalik at subukan ulit.* |
| Undo failed | *We could not undo this dose. Try again.* | *Hindi ma-undo ang dose na ito. Subukan ulit.* |
| Generic | *Something went wrong. Please try again.* | *May nangyaring mali. Subukan ulit.* |

**Empty state — no medicines yet**

- EN: *No medicines yet. Add the medicines your vet gave you. Type them as written on the label.* · [Add medicine]
- FIL: *Wala pang gamot. Idagdag ang mga gamot na ibinigay ng beterinaryo mo. I-type ayon sa nakasulat sa label.* · [Magdagdag ng gamot]

**Empty state — no doses logged**

- EN: *No doses logged yet. When you give a medicine, tap it here to log it.*
- FIL: *Wala pang naitalang dose. Kapag nagbigay ka ng gamot, pindutin dito para itala.*

### 4b. Refill reminder

Uses `quantity_on_hand` and `refill_alert_at`. Both numbers are entered by the person, not suggested by ATTICUS.

**Reminder (notification and card)**

- Title — EN: **Time to think about a refill** FIL: **Oras na para mag-refill**
- Body — EN: *{med} for {pet} is running low. About {count} left.* FIL: *Paubos na ang {med} ni {pet}. Mga {count} na lang.*
- Extra — EN: *Call your vet or pharmacy to ask about a refill.* FIL: *Tawagan ang beterinaryo o botika para magtanong tungkol sa refill.*
- Buttons — EN: *Remind me later* · *I got a refill* FIL: *Paalalahanan ako mamaya* · *Nakakuha na ako ng refill*

**Set-up labels**

- Pills left — EN: *How many are left?* · helper: *Count what you have at home.* FIL: *Ilan pa ang natitira?* · *Bilangin ang nasa bahay.*
- Reminder level — EN: *Remind me when this many are left* · helper: *Pick a number that gives you time to get more.* FIL: *Paalalahanan ako kapag ganito na lang karami ang natitira* · *Pumili ng numerong may sapat na oras para makabili ulit.*

**Empty / not set**

- EN: *Refill reminders are off. Add how many are left to turn them on.* FIL: *Naka-off ang paalala sa refill. Ilagay kung ilan ang natitira para i-on.*

**Out of medicine**

- EN: *{med} shows none left. If you still have some, update the count.* FIL: *Walang natitirang {med} ayon sa talaan. Kung mayroon pa, i-update ang bilang.*

**Errors**

| Situation | EN | FIL |
|---|---|---|
| Count can't be saved | *We could not save the count. Please try again.* | *Hindi ma-save ang bilang. Subukan ulit.* |
| Invalid number | *Please enter a number that is zero or more.* | *Maglagay ng numerong zero o higit pa.* |
| Reminders blocked in phone settings | *Notifications are off for ATTICUS. Turn them on in your phone settings to get refill reminders.* | *Naka-off ang notifications ng ATTICUS. I-on ito sa settings ng telepono para makatanggap ng paalala sa refill.* |

### 4c. Memorial mode

`set_pet_memorial` marks the pet as memorial and turns off all medicine reminders, med schedules, and meal schedules. Only the owner can do it. Tone: quiet, kind, no cheerful language, no upsell.

**Entry point** (Pet settings) — EN: *Memorial mode* · helper: *For when {pet} has passed away.* FIL: *Memorial mode* · *Para kapag pumanaw na si {pet}.*

**Confirm dialog**

- Title — EN: **Move {pet} to memorial mode?** FIL: **Ilipat si {pet} sa memorial mode?**
- Body — EN: *We are so sorry. This will turn off all reminders for {pet}. Medicine and meal schedules will stop. Everything you saved will be kept, and you can still look at it.* FIL: *Taos-puso kaming nakikiramay. Ititigil nito ang lahat ng paalala para kay {pet}. Hihinto ang iskedyul ng gamot at pagkain. Mananatili ang lahat ng na-save mo at maaari mo pa rin itong tingnan.*
- Field — EN: *Date {pet} passed away* (today is filled in; the person can change it) FIL: *Petsa ng pagpanaw ni {pet}*
- Buttons — EN: *Move to memorial mode* · *Not now* FIL: *Ilipat sa memorial mode* · *Hindi pa*

**After confirming** — EN: *{pet} is now in memorial mode. Their memories are safe here.* FIL: *Nasa memorial mode na si {pet}. Ligtas dito ang mga alaala niya.*

**Memorial home screen (empty-state style)**

- EN: *In loving memory of {pet}.* · *{pet} passed away on {date}.* · *You can look through photos, notes, and records any time.* · [View records] · [Export a copy]
- FIL: *Sa mapagmahal na alaala ni {pet}.* · *Pumanaw si {pet} noong {date}.* · *Maaari mong balikan ang mga larawan, tala, at talaan anumang oras.* · [Tingnan ang talaan] · [Mag-export ng kopya]
- Banner on logging screens — EN: *{pet} is in memorial mode. New logs are turned off.* FIL: *Nasa memorial mode si {pet}. Naka-off ang pagtatala.*

**Errors**

| Situation | EN | FIL |
|---|---|---|
| Not the owner | *Only the owner of this pet's account can do this.* | *Ang may-ari lamang ng account ang puwedeng gumawa nito.* |
| Could not save | *We could not do this right now. Nothing was changed. Please try again.* | *Hindi ito magawa ngayon. Walang nabago. Subukan ulit.* |

---

## 5. Checklist for review (for Mat)

- [ ] No example numbers anywhere (placeholders only).
- [ ] No "normal", "safe", "range", "high", "low" wording about a pet's health.
- [ ] Only suggested action is "call your vet" (also "ask your vet", which is a question, not a medical step).
- [ ] Store text does not claim to diagnose, monitor, or treat.
- [ ] Memorial tone is right for your users.
- [ ] Filipino reviewed by a native speaker (optional version).
- [ ] Vet review (PO-2) will check the preset labels, scales, and the threshold question.

## Approval

- Approved by: Mat · Date: 2026-11-12
- Open item: Filipino text still needs native-speaker review before release.
- Notes: __________
