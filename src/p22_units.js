<script>
/* ============================================================
   INCHES OR CENTIMETRES

   Every measurement in this app is stored the way it always was:
   lengths in inches, weights in pounds, temperatures in Fahrenheit,
   water in inches per week. That is not a statement about which
   system is better. It is the only arrangement in which the toggle
   can be lossless.

   The alternative — rewriting the rows when the switch is thrown —
   would round a 48" bed to 122cm, and back to 48.03", and back to
   122cm, and a gardener who flipped it a few times would find her
   beds had quietly changed size. So NOTHING on disk ever moves.
   Conversion happens at exactly two boundaries:

     · on the way out, when a number is drawn on screen
     · on the way in, when a number is typed into a field

   which means the toggle is instant, reversible, and cannot corrupt
   anything. It also means the canvas maths, the companion spacing,
   Geom, Solar and the whole recommendation engine keep working in
   inches and never need to know this file exists.

   The setting is read live from DB rather than cached, so it is
   already right after a vault load, a restore, or an imported
   garden, with nothing to remember to re-initialise.
   ============================================================ */

const Units = (() => {

  const IN_CM = 2.54;
  const LB_KG = 0.45359237;

  /* the app's written advice counts in words as often as in digits */
  const WORDS = { one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8,
    nine:9, ten:10, eleven:11, twelve:12, fifteen:15, eighteen:18, twenty:20,
    "twenty-four":24, thirty:30, "thirty-six":36 };

  /* round to a sensible number of places for the size of the figure —
     "exact, then rounded", never snapped to a friendlier number that is
     no longer the same measurement */
  function r(n, dp){
    const f = Math.pow(10, dp || 0);
    return Math.round(n * f) / f;
  }
  /* trailing .0 reads like a machine, not a garden */
  const trim = n => String(r(n, 2));

  const api = {
    /* ---------- the setting ---------- */
    get metric(){ return DB.get("units", "imperial") === "metric"; },
    set(metric){
      DB.set("units", metric ? "metric" : "imperial");
      return api.metric;
    },
    toggle(){ return api.set(!api.metric); },
    name(){ return api.metric ? "Metric" : "Imperial"; },

    /* the words that go next to an input box */
    lenUnit(){ return api.metric ? "cm" : "in"; },
    bigUnit(){ return api.metric ? "cm" : "ft"; },
    areaUnit(){ return api.metric ? "m²" : "sq ft"; },
    weightUnit(){ return api.metric ? "kg" : "lbs"; },
    tempUnit(){ return api.metric ? "°C" : "°F"; },

    /* ============================================================
       LENGTHS — canonical inches

       len()  small distances: spacing, sow depth, plant radii
       big()  bed dimensions, which people say in feet
       ============================================================ */
    lenN(inches){
      const v = num(inches, 0);
      return api.metric ? r(v * IN_CM, v * IN_CM < 10 ? 1 : 0) : r(v, 2);
    },
    len(inches, opts){
      const v = api.lenN(inches);
      if(api.metric) return trim(v) + ((opts && opts.space === false) ? "cm" : " cm");
      /* an inch mark is how this app has always written inches, and it is
         what a seed packet says too */
      return trim(v) + ((opts && opts.word) ? " in" : '"');
    },
    bigN(inches){
      const v = num(inches, 0);
      return api.metric ? r(v * IN_CM, 0) : r(v / 12, 1);
    },
    big(inches){
      return trim(api.bigN(inches)) + (api.metric ? " cm" : " ft");
    },
    /* "4 × 8 ft" / "122 × 244 cm" — one unit label for the pair */
    dims(wIn, hIn){
      return trim(api.bigN(wIn)) + "×" + trim(api.bigN(hIn)) + (api.metric ? " cm" : " ft");
    },

    /* ============================================================
       AREA — canonical square feet
       ============================================================ */
    areaN(sqFt){
      const v = num(sqFt, 0);
      if(!api.metric) return r(v, 1);
      /* a raised bed is a few square metres, so one decimal place would
         round 2.97 to 3 and quietly lose a third of a square metre */
      const m2 = v * 0.09290304;
      return r(m2, m2 < 10 ? 2 : 1);
    },
    area(sqFt){ return trim(api.areaN(sqFt)) + (api.metric ? " m²" : " sq ft"); },
    /* the app measures bed area in square inches in places */
    areaSqIn(sqIn){ return api.area(num(sqIn, 0) / 144); },

    /* ============================================================
       WEIGHT — canonical pounds
       ============================================================ */
    weightN(lbs){
      const v = num(lbs, 0);
      if(!api.metric) return r(v, 1);
      const kg = v * LB_KG;
      return r(kg, kg < 1 ? 2 : 1);
    },
    weight(lbs){ return trim(api.weightN(lbs)) + (api.metric ? " kg" : " lbs"); },
    /* for "cost per pound" / "cost per kilo", which reads better spelled out */
    perUnitWord(){ return api.metric ? "kilo" : "pound"; },
    /* yield per unit of ground: lbs/sq ft -> kg/m² */
    density(lbsPerSqFt){
      const v = num(lbsPerSqFt, 0);
      if(!api.metric) return r(v, 2) + " lbs/sq ft";
      return r(v * LB_KG / 0.09290304, 2) + " kg/m²";
    },

    /* ============================================================
       TEMPERATURE — canonical Fahrenheit

       Whole degrees. A germination floor of 60°F is not a precise
       number to begin with, and "15.6°C" pretends otherwise.
       ============================================================ */
    tempN(f){
      const v = num(f, 0);
      return api.metric ? Math.round((v - 32) * 5 / 9) : Math.round(v);
    },
    temp(f){ return api.tempN(f) + (api.metric ? "°C" : "°F"); },
    /* a span of degrees, not a point on the scale — 10°F warmer is 5.6°C
       warmer, and running it through tempN would make it -12°C */
    tempDeltaN(f){
      const v = num(f, 0);
      return api.metric ? r(v * 5 / 9, 1) : r(v, 1);
    },
    tempDelta(f){ return trim(api.tempDeltaN(f)) + (api.metric ? "°C" : "°F"); },

    /* ============================================================
       WATER — canonical inches, of rain or of irrigation
       ============================================================ */
    waterN(inches){
      const v = num(inches, 0);
      return api.metric ? r(v * IN_CM, 1) : r(v, 2);
    },
    water(inches){ return trim(api.waterN(inches)) + api.waterMark(); },
    waterMark(){ return api.metric ? " cm" : '"'; },
    waterWeek(inches){ return api.water(inches) + "/wk"; },

    /* how many plants fit in a unit of ground. psf is plants per square
       foot — a square-foot-gardening figure, so in metric it is restated
       per square metre rather than translated word for word. */
    perArea(psf){
      const v = num(psf, 0);
      if(!api.metric) return r(v, 2) + " per sq ft";
      return r(v / 0.09290304, 1) + " per m²";
    },

    /* ============================================================
       TYPED INPUT

       A field shows the number in whatever system is on and hands
       back inches (or lbs, or °F) to be stored. Both directions go
       through here so a value cannot drift by being written back in
       the unit it was displayed in.
       ============================================================ */
    inLen(v){ return api.metric ? num(v, 0) / IN_CM : num(v, 0); },
    outLen(inches){ return api.lenN(inches); },
    inBig(v){ return api.metric ? num(v, 0) / IN_CM : num(v, 0) * 12; },
    outBig(inches){ return api.bigN(inches); },
    inWeight(v){ return api.metric ? num(v, 0) / LB_KG : num(v, 0); },
    outWeight(lbs){ return api.weightN(lbs); },
    inTemp(v){ return api.metric ? num(v, 0) * 9 / 5 + 32 : num(v, 0); },
    outTemp(f){ return api.tempN(f); },
    inWater(v){ return api.metric ? num(v, 0) / IN_CM : num(v, 0); },
    outWater(inches){ return api.waterN(inches); },

    /* a step size that makes sense for the unit on show */
    lenStep(){ return api.metric ? "0.5" : "0.25"; },
    bigStep(){ return api.metric ? "1" : "0.5"; },
    waterStep(){ return api.metric ? "0.5" : "0.25"; },
    weightStep(){ return api.metric ? "0.1" : "0.1"; },

    /* ============================================================
       PROSE

       Growing notes, harvest instructions and diagnosis treatments
       are written English, with measurements inside the sentences:
       "peppers sulk below 55°F", "thin to 6–8 inches", "give it 6
       feet of trellis". A metric reader should not have to do the
       arithmetic there either, and leaving it while the headings
       above it read in centimetres is worse than not offering the
       switch at all.

       Ranges are rewritten before single figures, so "6–8 inches"
       becomes "15–20 cm" rather than "6–20 cm". Anything the
       patterns do not recognise is left exactly as written — this
       never guesses at a number it did not clearly identify.
       ============================================================ */
    prose(s){
      if(!api.metric || !s) return s || "";
      let t = String(s);
      const cm = v => trim(r(v * IN_CM, v * IN_CM < 10 ? 1 : 0));
      const ft = v => { const c = v * 30.48; return c >= 100 ? trim(r(c / 100, 1)) + " m" : trim(r(c, 0)) + " cm"; };
      const N = "(\\d+(?:\\.\\d+)?)";
      const D = "\\s*(?:–|—|-|\\s+to\\s+)\\s*";

      /* ranges first */
      t = t.replace(new RegExp(N + D + N + "\\s*°F", "g"), (m, a, b) =>
        api.tempN(+a) + "–" + api.tempN(+b) + "°C");
      t = t.replace(new RegExp(N + D + N + "\\s*(?:inches|inch|in\\.)\\b", "gi"), (m, a, b) =>
        cm(+a) + "–" + cm(+b) + " cm");
      t = t.replace(new RegExp(N + D + N + "\\s*(?:feet|foot|ft\\.?)\\b", "gi"), (m, a, b) =>
        trim(r(+a * 30.48, 0)) + "–" + ft(+b));
      t = t.replace(new RegExp(N + D + N + "\\s*(?:lbs?|pounds?)\\b", "gi"), (m, a, b) =>
        trim(api.weightN(+a)) + "–" + trim(api.weightN(+b)) + " kg");

      /* then single figures */
      t = t.replace(new RegExp(N + "\\s*°F", "g"), (m, a) => api.tempN(+a) + "°C");
      t = t.replace(new RegExp(N + "\\s*(?:inches|inch|in\\.)\\b", "gi"), (m, a) => cm(+a) + " cm");
      t = t.replace(new RegExp(N + "\\s*(?:feet|foot|ft\\.?)\\b", "gi"), (m, a) => ft(+a));
      t = t.replace(new RegExp(N + "\\s*(?:lbs?|pounds?)\\b", "gi"), (m, a) => trim(api.weightN(+a)) + " kg");
      /* an inch mark, but only where it cannot be a closing quote */
      t = t.replace(new RegExp(N + '"(?=\\s|$|[.,;)])', "g"), (m, a) => cm(+a) + " cm");

      /* Written-out numbers, because that is how this app's own advice is
         phrased: "push a finger two inches into the soil", "strip the bottom
         twelve inches of leaves", "four to six inches away from stems". A
         word is only touched when a unit follows it immediately, so ordinary
         prose — "two of the three beds" — is never disturbed. */
      const W = "(" + Object.keys(WORDS).join("|") + ")";
      t = t.replace(new RegExp(W + "\\s+(?:to|–|—|-)\\s+" + W + "\\s+(inches|inch|feet|foot)\\b", "gi"),
        (m, a, b, u) => {
          const f = /f/i.test(u.charAt(0)) ? 30.48 : IN_CM;
          return trim(r(WORDS[a.toLowerCase()] * f, 0)) + "–" + trim(r(WORDS[b.toLowerCase()] * f, 0)) + " cm";
        });
      t = t.replace(new RegExp(W + "\\s+(inches|inch|feet|foot)\\b", "gi"), (m, a, u) => {
        const n = WORDS[a.toLowerCase()];
        return /f/i.test(u.charAt(0)) ? ft(n) : cm(n) + " cm";
      });
      return t;
    }
  };
  return api;
})();

/* Prose is escaped everywhere it is printed, so the two always travel
   together. `esc(x)` becomes `escU(x)` at any site showing written
   guidance that may carry a measurement inside it. */
function escU(s){ return esc(Units.prose(s)); }
</script>
