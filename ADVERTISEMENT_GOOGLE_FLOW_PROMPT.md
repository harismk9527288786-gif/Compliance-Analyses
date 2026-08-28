# Google Flow (Veo) Prompt Pack — MTC Compliance Checker Advertisement

**Hard constraint: zero humans on screen.** No people, no hands, no faces, no silhouettes, no
reflections of people, no shadows cast by people, no crowds, no chairs being sat in.

The whole film is built from three things only: **the product UI**, **the documents it reads**, and
**the industrial world those documents come from** (steel, forgings, valves, mill floors, ladles).

---

## ⚠️ Read this first — the single most important technique

**Never write "no humans" inside a Flow prompt.** Diffusion video models frequently generate whatever
noun you mention, negation included. Saying "no engineer" often produces an engineer.

Instead, describe the emptiness **affirmatively**, and let objects move on their own:

| ❌ Don't write | ✅ Write instead |
| :--- | :--- |
| "no people in the lab" | "a deserted inspection lab, still and unattended" |
| "an engineer reviews the report" | "the report scrolls by itself, untouched" |
| "a hand swipes the screen" | "the panel advances on its own, no contact" |
| "no workers on the mill floor" | "an automated mill floor operating unmanned after hours" |
| "over the shoulder" | "locked-off camera at desk height" |

**Words to keep out of every prompt entirely:** person, people, human, man, woman, engineer,
inspector, worker, technician, team, hand, finger, arm, face, eyes, crowd, someone, they, staff,
operator, user, holding, wearing, walking, sitting, over-the-shoulder, POV, selfie, portrait.

If you ever move this to Veo on Vertex AI (which *does* have a `negativePrompt` field), use:

```
person, people, human, hands, fingers, face, silhouette, crowd, body, skin, mannequin,
reflection of a person, text gibberish, watermark, logo artifacts, warped letters
```

---

## Master style block

Paste this at the **top of every single shot prompt**. Consistency across clips is what makes seven
separate 8-second generations feel like one film.

```
STYLE: Premium industrial B2B software film. Cinematic macro product cinematography.
Photoreal, high-end commercial polish — shot like a precision-instrument advertisement.
Shallow depth of field, anamorphic-style flares, fine airborne dust motes catching the light,
subtle film grain, very slow deliberate camera motion on a motorized slider.

PALETTE (strict): deep navy-black base #020617 and #0F172A. Panel surfaces slate #1E293B with
thin #334155 hairline borders. Signal emerald #10B981 / #059669 for confirmation. Amber #F59E0B
for caution. Rose-red #F43F5E for critical alerts. Cool sky-blue #0EA5E9 rim light as the only
secondary. Pale slate #F1F5F9 for bright document paper.

RECURRING MOTIF: a faint dot-grid — 1.5px slate dots on a 24px pitch — floating in the darkness,
with a soft emerald radial glow drifting slowly across it.

TYPOGRAPHY: crisp monospaced technical type, tight tracking, only ever short numeric strings.

ENVIRONMENT: every space is deserted, silent, unattended. Objects, documents and interface panels
move, assemble and animate entirely on their own, untouched. Nothing organic is present.

CAMERA: locked-off or slow push-in / slow lateral slide only. No handheld, no whip pans.
ASPECT: 16:9. Duration: 8 seconds.
```

---

## SHOT LIST — 7 × 8s = 56 seconds

Each block below is a complete, self-contained Flow prompt. Prepend the master style block, then
generate one clip per shot. Shots marked **[CUT-DOWN: KEEP]** form the 32-second version.

---

### SHOT 1 — The cost of doing it by hand **[CUT-DOWN: KEEP]**

```
A deserted quality-inspection bay inside a steel forging plant, late at night, lit only by one
cold overhead fixture and a distant amber glow from the furnace hall beyond the glass.

On a brushed-steel inspection bench sits a tall, slightly leaning stack of printed Material Test
Certificates — dense tables of chemical values, mill stamps, EN 10204 3.1 headers. Beside the
stack, a heavy forged carbon-steel flange and a machined gate-valve casting rest on the bench, cool
blue rim light tracing their machined edges. A mechanical desk stopwatch ticks on the far right of
frame, its thin needle sweeping around the dial.

Camera: extremely slow push-in from wide to medium, at bench height, drifting past the flange
toward the paper stack. Dust motes float through the light beam.

The bench is unattended. The paper does not move. Nothing in the room is alive except the
sweeping needle and the drifting dust.

Colour: deep navy shadows, one pool of cold white light, a far-off amber furnace bloom.
Mood: heavy, expensive, wasted time.

AUDIO: low industrial room hum, faint distant furnace roar, the dry mechanical tick of the
stopwatch, a slow rising sub-bass swell. No music yet. No voices.
```

*On-screen text (add in post, or Flow's text layer):* `45–90 MINUTES. PER CERTIFICATE.`

---

### SHOT 2 — Ingest **[CUT-DOWN: KEEP]**

```
Pure black void with the faint slate dot-grid receding into depth.

A single sheet of a Material Test Certificate glides in from frame left, weightless and level,
lit from beneath. It passes through a thin horizontal plane of emerald #10B981 light — a scanning
sheet, like a laser level. As the plane sweeps across the page, the printed data lifts off the
paper: small monospaced tokens detaching and floating upward in ordered columns —
"C 0.21", "Mn 0.88", "P 0.012", "HEAT-8821A", "HEAT-8821B", "542 MPa", "910 °C".

The tokens sort themselves in mid-air into neat aligned columns, snapping into place with tiny
emerald flashes. The now-blank page continues drifting out of frame right.

Camera: slow lateral slide following the page, then a gentle rack focus from the paper to the
floating data columns.

The page moves under its own power. Nothing touches it.

AUDIO: a soft airy whoosh as the page enters, a clean rising synth sweep for the scan plane,
crisp granular data-tick clicks as each token locks into position. Pulse of low electronic
music begins underneath.
```

*On-screen text:* `EXTRACT · NORMALIZE · TRACE`

---

### SHOT 3 — The engine runs **[CUT-DOWN: KEEP]**

```
Macro shot deep inside a dark software interface floating in the black void — slate #1E293B
panels with #334155 hairline borders, stacked as a tall vertical list of verification rows.

The list scrolls upward rapidly on its own. Each row carries a monospaced label and a status
chip on the right. One after another at machine speed, the chips ignite emerald #10B981 and
read "PASS" — dozens of them cascading up the frame like a rising ladder of green light, each
one throwing a brief glow onto the panel beside it. Faint clause references flicker in the
margin: "Clause 3.1", "Clause 4.2", "Clause 5.1", "ASTM A105 Tab. 1".

A counter in the upper corner climbs in monospaced digits: 04 … 11 … 19 … 26 … 29.

Camera: locked off, very slight push-in, shallow focus so the top and bottom rows fall into
soft bokeh and only the centre band is razor sharp.

The interface operates entirely by itself — nothing is clicked, nothing is touched.

AUDIO: rapid, precise, high-frequency mechanical ticks — one per row, accelerating, like a
Geiger counter of certainty. Driving low electronic pulse. A synth riser building tension.
```

*On-screen text:* `33 CLAUSES. UNDER 10 SECONDS.`

---

### SHOT 4 — The catch (the hero moment) **[CUT-DOWN: KEEP]**

```
Continuing the same dark interface. The cascade of emerald PASS chips is running at full speed —
then everything slams to a hard freeze. The scroll stops dead. The emerald glow drains out of
the frame and the panels dim to near-black.

One single row in the exact centre of frame ignites rose-red #F43F5E. A thin red scanline pulses
outward from it. The row reads in sharp monospaced type:

  NORMALIZING TEMPERATURE   REQUIRED 900–960 °C   REPORTED 890 °C   DEVIATION

A "CRITICAL" tag pulses beside it. Behind the panel, out of focus, a molten orange glow flares
briefly — the ghost of a heat-treatment furnace running too cold.

Then, one beat later, a second row below lights amber #F59E0B:

  ELONGATION (A5)   REQUIRED MIN 30 %   REPORTED 29 %   DEVIATION

And below that, two rows stamp themselves with a hollow amber outline reading
"NOT IDENTIFIED IN MTC".

Camera: fast, aggressive macro push-in onto the red row, then settle. Lens flare on the red.

Nothing living is present. The interface finds this entirely on its own.

AUDIO: the ticking cuts to total silence. One deep, heavy metallic clunk — like a vault bolt
dropping — on the red row. A low ominous sub-bass drop. A single sharp amber alert blip for the
second row. Held tension.
```

*On-screen text:* `10 °C UNDER SPEC. CAUGHT.`

---

### SHOT 5 — The metallurgy (Carbon Equivalent)

```
Cut to a wide macro of molten steel: a foundry ladle pouring a thin brilliant stream of white-hot
metal in a completely deserted, automated mill hall, sparks arcing in slow motion, everything else
in deep navy shadow.

Floating in the foreground, in glowing emerald monospaced type, a formula assembles itself piece
by piece, each term flying in and locking with a soft flash:

  CE = C + Mn/6 + (Cr + Mo + V)/5 + (Ni + Cu)/15

Beneath it, three values resolve in sequence:

  CALCULATED  0.39 wt%
  MAX ALLOWED  ≤ 0.43 wt%

The comparison completes and a clean emerald checkmark badge draws itself in a single stroke:
"CONFORMANCE VERIFIED".

Camera: slow drift right across the pour, formula locked steady in the foreground plane,
rack focus from the sparks back to the formula.

The mill runs unmanned. The formula computes itself.

AUDIO: the deep roar of pouring molten metal, crackling sparks, and over it a clean precise
emerald confirmation chime. Music resolves from tension into forward momentum.
```

*On-screen text:* `THE MATH, DONE FOR YOU.`

---

### SHOT 6 — The deliverables **[CUT-DOWN: KEEP]**

```
Black void, dot-grid floating, a soft emerald radial glow blooming from centre frame.

Three objects assemble themselves out of thin streams of light and fan out into a slow, elegant
rotating arc, evenly spaced, each hovering and gently rotating:

LEFT — a formal PDF inspection certificate, crisp pale slate #F1F5F9 paper, an emerald header
bar, dense verification tables, and an empty digital sign-off block at the base.

CENTRE — a multi-tab spreadsheet matrix, its sheet tabs flicking open one by one, rows
colour-coded in emerald, amber and rose-red bands.

RIGHT — a formal clarification letter, four numbered action points writing themselves line by
line in monospaced type.

Thin emerald connector lines trace between the three, showing they share one source.

Camera: slow orbital dolly around the arc, shallow focus travelling from left object to right.

The documents build, open and write themselves. Nothing handles them.

AUDIO: three distinct crisp paper-and-glass assembly sounds, one per object, each with a short
emerald tone. Confident, clean, forward-moving music.
```

*On-screen text:* `PDF · EXCEL · SUPPLIER LETTER — ONE CLICK`

---

### SHOT 7 — Close and logo **[CUT-DOWN: KEEP]**

```
Macro on a circular progress ring floating in the dark. Its arc draws itself clockwise in three
segments — a long emerald #10B981 sweep, then a short rose-red, then a short amber — and a
monospaced figure counts up in the centre to "87.9%". Beneath it, small type: "QUALITY INDEX".

The camera pulls back smoothly and the ring reveals itself as one card inside a full compliance
dashboard: dark slate panels, verification tables, a status banner. A large emerald stamp
descends and presses onto the frame with a firm settle: "TECHNICAL SIGN-OFF".

The dashboard dissolves into the dot-grid, which resolves into a clean logo lockup centred on
deep navy #0F172A: a rounded-square badge containing a stylised certificate document with an
emerald circular checkmark badge at its lower right — exactly the app icon.

Beneath the badge, two lines of type fade up:

  MTC COMPLIANCE CHECKER
  Deterministic metallurgical verification.

Camera: continuous smooth pull-back, then a slow settle to a perfectly still centred hold on
the logo for the final two seconds.

AUDIO: the ring draws with a smooth ascending sweep, the stamp lands with a satisfying deep
mechanical press, then one warm resolving emerald chord. Music arrives at its final resolution
and holds. Silence on the last half second.
```

*On-screen text (final card):* `EN 10204 3.1 · ASTM · ASME · NACE MR0175 / ISO 15156 · ISO 9001 AUDIT-READY`

---

## Optional voice-over

A voice-over is safe — the constraint is that no human is **shown**. If you want one, keep it low,
calm and unhurried. Timed to the shots above:

> *(Shot 1)* Every certificate hides a number that shouldn't be there.
> *(Shot 3)* Thirty-three clauses. Every heat. Every element.
> *(Shot 4)* Nine hundred degrees required. Eight-ninety reported. Found in under ten seconds.
> *(Shot 6)* Report, matrix, and supplier letter — generated, not drafted.
> *(Shot 7)* MTC Compliance Checker. Deterministic metallurgical verification.

If you'd rather have no voice at all, the on-screen text cards above carry the whole story on
their own — which is usually the stronger choice for a silent-autoplay LinkedIn feed.

---

## Production notes for Flow specifically

**Use your own screenshots as ingredients.** Veo will invent plausible-looking but fictional UI if
you let it. Flow's **Frames to Video** and **Ingredients to Video** modes let you supply reference
images. Feed it: a screenshot of your actual analysis view, a page of the exported PDF report, and
the app icon. Shots 3, 4, 6 and 7 improve dramatically when anchored to real frames, and the UI
then actually looks like your product.

**Text inside generated video is unreliable.** Veo garbles long strings. Two rules: keep any text
you ask the model to render to short numeric fragments (`890 °C`, `87.9%`, `PASS`), and add every
headline card, the tagline and the final logo lockup as a **post-production overlay** in Flow's
editor rather than asking the model to draw them. Your logo especially — never let a video model
attempt a logo.

**Generate 3–4 variants per shot and pick.** Shot 4 is the money shot; give it the most attempts.
Shots 1 and 5 are the most likely to smuggle in a person, since "inspection bay" and "mill hall"
are human-coded environments in training data. Watch for a stray hand at the edge of frame and
regenerate rather than trying to fix it.

**Cut lengths.** 56s full film for the website and YouTube. The five `[CUT-DOWN: KEEP]` shots give
you a 40s edit; trimming each to ~4s gives a 20s pre-roll. For LinkedIn and Instagram, regenerate
in **9:16** with the same prompts — change only the aspect line and, in Shot 3, ask for the row
list to fill the tall frame vertically, which actually suits vertical better than 16:9 does.

**Keep the grade consistent.** If one clip comes back warmer or brighter than the others, fix it in
the edit rather than regenerating — a small colour-match pass is faster than chasing the model.

---

## Why these specific numbers

Everything quoted above is real output from your own pilot benchmark
(`Pilot Benchmark Analysis: Western Forge (WW2606229-3) vs Hawa MDS Rev A`) so the ad can't be
accused of inventing a demo: 33 total clauses, 29 conforming, 2 metallurgical deviations, 2
documentation gaps, 87.9% pass rate. The critical deviation is normalizing temperature on heat YBA
at 890 °C against a required 900–960 °C. The major deviation is elongation at 29% against a 30%
minimum. The two gaps are missing UT and MPT evidence. Carbon Equivalent calculates to 0.39 wt%
against a 0.43 wt% ceiling, so it passes — which is a *better* story than a CE failure, because it
shows the engine confirming as confidently as it rejects.
