<script>
/* ============================================================
   CONDITION SOURCES
   Each diagnosis links to an official extension page so the
   advice can be checked against the institution that wrote it.
   Every URL below was taken from, or confirmed on, the
   publishing extension service's own site.
   ============================================================ */
const COND_SRC = {
  /* nutrients & disorders */
  "n-def":      [["UMN Extension — planting the vegetable garden","https://extension.umn.edu/planting-and-growing-guides/planting-vegetable-garden"],
                 ["Clemson HGIC — liming and fertilizing vegetables","https://hgic.clemson.edu/factsheet/fertilizing-vegetables/"]],
  "k-def":      [["Clemson HGIC — liming and fertilizing vegetables","https://hgic.clemson.edu/factsheet/fertilizing-vegetables/"]],
  "p-def":      [["Clemson HGIC — liming and fertilizing vegetables","https://hgic.clemson.edu/factsheet/fertilizing-vegetables/"]],
  "mg-def":     [["Clemson HGIC — liming and fertilizing vegetables","https://hgic.clemson.edu/factsheet/fertilizing-vegetables/"]],
  "fe-def":     [["Clemson HGIC — changing the pH of your soil","https://hgic.clemson.edu/factsheet/changing-the-ph-of-your-soil/"]],
  "ca-ber":     [["UMN Extension — tomato disorders (blossom end rot)","https://extension.umn.edu/plant-diseases/tomato-disorders"],
                 ["Clemson HGIC — tomato diseases and disorders","https://hgic.clemson.edu/factsheet/tomato-diseases-disorders/"]],
  "over-fert":  [["Clemson HGIC — liming and fertilizing vegetables","https://hgic.clemson.edu/factsheet/fertilizing-vegetables/"]],
  "ph-lock":    [["Clemson HGIC — changing the pH of your soil","https://hgic.clemson.edu/factsheet/changing-the-ph-of-your-soil/"],
                 ["UMN Extension — soil testing","https://soiltest.cfans.umn.edu/"]],

  /* water, light, weather */
  "overwater":  [["UMN Extension — watering (growing tomatoes guide)","https://extension.umn.edu/vegetables/growing-tomatoes"]],
  "underwater": [["UMN Extension — watering (growing tomatoes guide)","https://extension.umn.edu/vegetables/growing-tomatoes"]],
  "sunscald":   [["UMN Extension — tomato disorders (sunscald)","https://extension.umn.edu/plant-diseases/tomato-disorders"]],
  "lowlight":   [["UMN Extension — planting the vegetable garden","https://extension.umn.edu/planting-and-growing-guides/planting-vegetable-garden"]],
  "frost":      [["USDA — Plant Hardiness Zone Map","https://planthardiness.ars.usda.gov/"],
                 ["UMN Extension — planting the vegetable garden","https://extension.umn.edu/planting-and-growing-guides/planting-vegetable-garden"]],
  "transplant-shock":[["UMN Extension — starting seeds indoors (growing tomatoes guide)","https://extension.umn.edu/vegetables/growing-tomatoes"]],
  "heat-stress":[["UMN Extension — tomato disorders","https://extension.umn.edu/plant-diseases/tomato-disorders"]],
  "bolt":       [["UMN Extension — growing kohlrabi (bolting)","https://extension.umn.edu/vegetables/growing-kohlrabi"]],
  "poor-poll":  [["UMN Extension — tomato disorders","https://extension.umn.edu/plant-diseases/tomato-disorders"]],
  "crowding":   [["UMN Extension — planting the vegetable garden","https://extension.umn.edu/planting-and-growing-guides/planting-vegetable-garden"]],
  "herbicide":  [["UMN Extension — tomato viruses and disorders","https://extension.umn.edu/plant-diseases/tomato-disorders"]],

  /* disease */
  "powdery":    [["UMN Extension — yard and garden problems","https://extension.umn.edu/yard-and-garden/yard-and-garden-problems"]],
  "downy":      [["Cornell — disease resistant vegetable varieties","https://www.vegetables.cornell.edu/pest-management/disease-factsheets/disease-resistant-vegetable-varieties/"]],
  "early-blight":[["UMN Extension — early blight of tomato","https://extension.umn.edu/node/2681"],
                 ["Clemson HGIC — tomato diseases and disorders","https://hgic.clemson.edu/factsheet/tomato-diseases-disorders/"]],
  "late-blight":[["UMN Extension — late blight","https://extension.umn.edu/node/2861"]],
  "septoria":   [["Clemson HGIC — tomato diseases and disorders","https://hgic.clemson.edu/factsheet/tomato-diseases-disorders/"]],
  "wilt-fung":  [["Cornell — disease resistant vegetable varieties","https://www.vegetables.cornell.edu/pest-management/disease-factsheets/disease-resistant-vegetable-varieties/"]],
  "damping-off":[["UMN Extension — starting seeds indoors (growing tomatoes guide)","https://extension.umn.edu/vegetables/growing-tomatoes"]],
  "botrytis":   [["UMN Extension — cultural practices for tomato diseases","https://extension.umn.edu/node/11626"]],
  "rust":       [["UMN Extension — cultural practices for disease","https://extension.umn.edu/node/11626"]],
  "bact-spot":  [["UMN Extension — bacterial spot of tomato","https://extension.umn.edu/node/2116"]],
  "mosaic-virus":[["UMN Extension — tomato viruses","https://extension.umn.edu/node/3531"]],

  /* pests */
  "aphid":      [["UMN Extension — aphids in home gardens","https://extension.umn.edu/node/5246"],
                 ["Clemson HGIC — IPM for aphids","https://hgic.clemson.edu/factsheet/integrated-pest-management-i-p-m-for-aphids/"]],
  "spidermite": [["UMN Extension — yard and garden insects","https://extension.umn.edu/yard-and-garden/yard-and-garden-insects"]],
  "whitefly":   [["UMN Extension — yard and garden insects","https://extension.umn.edu/yard-and-garden/yard-and-garden-insects"]],
  "flea-beetle":[["UMN Extension — flea beetles","https://extension.umn.edu/node/3671"]],
  "cabbageworm":[["UMN Extension — imported cabbageworm and cabbage looper","https://extension.umn.edu/node/8331"]],
  "hornworm":   [["UMN Extension — tomato hornworm","https://extension.umn.edu/node/11631"]],
  "squashbug":  [["UMN Extension — yard and garden insects","https://extension.umn.edu/yard-and-garden/yard-and-garden-insects"]],
  "vine-borer": [["UMN Extension — yard and garden insects","https://extension.umn.edu/yard-and-garden/yard-and-garden-insects"]],
  "cucbeetle":  [["UMN Extension — yard and garden insects","https://extension.umn.edu/yard-and-garden/yard-and-garden-insects"]],
  "slug":       [["UMN Extension — yard and garden insects","https://extension.umn.edu/yard-and-garden/yard-and-garden-insects"]],
  "thrips":     [["UMN Extension — yard and garden insects","https://extension.umn.edu/yard-and-garden/yard-and-garden-insects"]],
  "leafminer":  [["UMN Extension — yard and garden insects","https://extension.umn.edu/yard-and-garden/yard-and-garden-insects"]],
  "japanese":   [["UMN Extension — yard and garden insects","https://extension.umn.edu/yard-and-garden/yard-and-garden-insects"]]
};

CONDITIONS.forEach(c => { c.src = COND_SRC[c.id] || [["Ask Extension — your local office","https://ask.extension.org/"]]; });

/* claims that deserve an explicit caveat rather than a flat statement */
const CLAIM_NOTES = {
  powdery:"Milk sprays have been studied and show real suppression of powdery mildew, but results vary by crop and conditions. Treat it as a useful early measure, not a guaranteed cure.",
  japanese:"Extension research consistently finds pheromone traps draw in more beetles than they capture — this is why the advice is to skip them near the garden.",
  marigoldish:"French marigold suppression of root-knot nematodes is documented, but it works as a dense planting or rotation crop, not as a few plants dotted between vegetables.",
  hornworm:"The white 'rice grains' on a hornworm are cocoons of a parasitic braconid wasp. Leaving that caterpillar in place lets the next generation of wasps emerge.",
  "ca-ber":"Blossom end rot is a calcium-distribution problem driven by uneven watering, not usually a calcium shortage in the soil. Foliar calcium sprays reach the fruit poorly."
};
</script>
