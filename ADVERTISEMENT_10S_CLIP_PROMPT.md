# Google Flow — Single 10-Second Fast-Motion Ad Prompt

**MTC Compliance Checker** · one continuous clip · core features in rapid montage · **zero humans**

Paste the block below into Flow as one prompt.

```
Fast-cut 10-second premium industrial software advertisement. Photoreal cinematic macro product
cinematography with high-end precision-instrument commercial polish. Rapid-fire montage: one
distinct beat every 2 seconds, quick snap transitions, everything moving at accelerated speed with
a brief slow-motion punctuation on the alert beat. Shallow depth of field, anamorphic flares, fine
airborne dust motes, subtle film grain.

SETTING: a black void with a faint slate dot-grid (1.5px dots on a 24px pitch) drifting in depth,
lit by a soft emerald radial glow. Every space is deserted, silent and unattended — the documents
and interface panels move, assemble and animate entirely on their own, untouched. Nothing organic
is present anywhere in frame at any moment.

PALETTE (strict): deep navy-black #020617 base, slate #1E293B panels with #334155 hairline borders,
signal emerald #10B981 for confirmation, amber #F59E0B for caution, rose-red #F43F5E for critical
alerts, cool sky-blue #0EA5E9 rim light, pale slate #F1F5F9 document paper. Crisp monospaced
technical type, short numeric strings only.

BEAT 1 — INGEST (0.0–2.0s): a Material Test Certificate sheet glides in fast from frame left and
passes through a horizontal plane of emerald laser light. The printed data lifts off the page and
snaps upward into ordered floating columns of monospaced tokens: "C 0.21", "Mn 0.88", "542 MPa",
"910 °C", "HEAT-8821A". Whip-quick and weightless. Camera: fast lateral slide.

BEAT 2 — VERIFY (2.0–4.0s): macro on a tall vertical list of dark slate verification rows scrolling
upward at machine speed. Status chips ignite emerald one after another reading "PASS", a rising
ladder of green light, clause references flickering in the margin — "Clause 3.1", "Clause 4.2". A
monospaced counter climbs 04 … 19 … 29. Camera: locked off, slight push-in, shallow focus.

BEAT 3 — CATCH (4.0–6.0s): everything slams to a hard freeze, the emerald drains out and the panels
dim to near-black. One centre row ignites rose-red #F43F5E with a scanline pulsing outward, reading
"NORMALIZING TEMPERATURE — REQUIRED 900–960 °C — REPORTED 890 °C — DEVIATION". Brief slow motion. A
molten orange furnace glow flares far behind, out of focus. Camera: aggressive fast macro push-in
with a red lens flare.

BEAT 4 — COMPUTE (6.0–8.0s): snap cut to a thin stream of white-hot molten steel pouring inside a
deserted automated mill hall, sparks arcing through deep navy shadow. In the foreground an emerald
monospaced formula assembles itself term by term — "CE = C + Mn/6 + (Cr+Mo+V)/5 + (Ni+Cu)/15" —
resolving to "0.39 ≤ 0.43 wt%" as an emerald checkmark badge draws itself in one stroke. Camera:
fast drift right, formula locked steady in the foreground plane.

BEAT 5 — DELIVER & CLOSE (8.0–10.0s): snap back to the dot-grid void. Three documents assemble out
of streams of light and fan into a fast rotating arc — a pale-slate PDF certificate with an emerald
header bar, a spreadsheet matrix with its tabs flicking open over emerald, amber and red
colour-coded rows, and a numbered clarification letter writing itself line by line. A circular
progress ring sweeps emerald and counts to "87.9%", then a large emerald stamp presses down and
settles: "TECHNICAL SIGN-OFF". Hold perfectly still on the final frame for the last half second.
Camera: quick orbital dolly, then a hard settle to a locked-off hold.

AUDIO: driving fast electronic pulse throughout. Airy whoosh on the page, rapid accelerating
mechanical data-ticks through the PASS cascade, total silence then one deep metallic vault-bolt
clunk on the red alert, molten roar and crackling sparks, three crisp assembly snaps, and a final
deep stamp press resolving into one warm emerald chord. No voices.

ASPECT: 16:9. Duration: 10 seconds.
```

## Notes

**Flow generates 8-second clips.** Set the duration to 8s and extend to 10s with Flow's *Extend*
control, or generate at 8s and let Beat 5 run slightly tighter — the beats are written so that
dropping to 1.6s each still reads cleanly. If you extend, the last beat is the one to grow.

**Never write "no humans" in the prompt.** Video models tend to render whatever noun you mention,
negation included. The emptiness is stated affirmatively above instead ("deserted", "unattended",
"untouched", "nothing organic"), and the banned vocabulary — person, hand, face, engineer, worker,
operator, body — appears nowhere in the block. Don't add it back when you tweak.

**Anchor the UI to reality.** Use Flow's *Ingredients to Video* with a screenshot of your actual
analysis view and a page of the exported PDF, otherwise Veo invents plausible but fictional
interface. Add the logo lockup and any headline text as a post overlay rather than asking the model
to draw them.

**Five beats is the ceiling at this length.** If a generation comes back mushy or the beats blur
together, cut Beat 4 (the CE formula) rather than shortening all five — four clean beats beat five
smeared ones.

All values are real output from the `WW2606229-3` pilot benchmark: 29 conforming clauses, the 890 °C
normalizing deviation on heat YBA, CE 0.39 wt% against the 0.43 ceiling, 87.9% pass rate.
