<script>
/* ============================================================
   PLANT DOCTOR — camera, image analysis, symptom triage
   ============================================================ */
const SYMPTOMS = [
  { g:"Colour", items:[
    ["yellow-old","Older / lower leaves yellowing"],
    ["yellow-new","New growth yellow or pale"],
    ["yellow-veins","Yellow between green veins"],
    ["yellow-whole","Whole plant pale or yellow"],
    ["purple-tint","Purple or reddish tint on leaves/stems"],
    ["dark-green","Unusually dark green, lush, no fruit"]
  ]},
  { g:"Marks & texture", items:[
    ["spots-brown","Brown or tan spots"],
    ["spots-target","Spots with concentric rings (target-like)"],
    ["spots-halo","Small spots with yellow halos"],
    ["white-powder","White powdery coating"],
    ["fuzzy-gray","Gray or fuzzy mould"],
    ["rust-orange","Orange or rusty pustules underneath"],
    ["mosaic","Mottled light/dark mosaic pattern"],
    ["edges-brown","Leaf edges brown and crispy"],
    ["tips-brown","Leaf tips browning"],
    ["stippling","Fine pale stippling / speckled dots"],
    ["silver-streaks","Silvery streaks or scarring"],
    ["sticky","Sticky residue on leaves"],
    ["sooty","Black sooty film"],
    ["webbing","Fine webbing"]
  ]},
  { g:"Shape & structure", items:[
    ["wilting","Wilting"],
    ["wilt-one-side","Wilts on one side / one branch"],
    ["curl-down","Leaves curling downward"],
    ["curl-up","Leaves curling upward or cupping"],
    ["distorted","New growth twisted or distorted"],
    ["leggy","Stretched, leggy, thin stems"],
    ["stunted","Stunted, not growing"],
    ["collapse","Sudden collapse"],
    ["seedling-fell","Seedling toppled at soil line"],
    ["stem-lesion","Dark lesion on the stem"]
  ]},
  { g:"Damage", items:[
    ["holes","Holes chewed in leaves"],
    ["skeletonized","Leaves skeletonized to the veins"],
    ["edges-chewed","Ragged chewed edges"],
    ["slime","Slime trails"],
    ["tunnels","Squiggly tunnels inside the leaf"],
    ["sunbleach","Bleached white/tan patches"]
  ]},
  { g:"Fruit & flowers", items:[
    ["blossom-end","Sunken black patch on the blossom end"],
    ["fruit-crack","Fruit cracking or splitting"],
    ["fruit-rot","Fruit rotting on the plant"],
    ["no-set","Flowers drop, no fruit set"],
    ["misshapen-fruit","Small or misshapen fruit"],
    ["bolting","Bolting — sending up a flower stalk early"]
  ]},
  { g:"Pests you can see", items:[
    ["p-aphid","Clusters of small soft green/black insects"],
    ["p-whitefly","Tiny white flies rise when disturbed"],
    ["p-flea","Tiny black beetles that jump"],
    ["p-caterpillar","Green caterpillars"],
    ["p-hornworm","Large green caterpillar with a horn"],
    ["p-squashbug","Gray-brown shield-shaped bugs"],
    ["p-cucbeetle","Striped or spotted yellow beetles"],
    ["p-japanese","Metallic green/copper beetles"],
    ["p-mite","Dust-fine red or yellow mites"],
    ["p-slug","Slugs or snails"],
    ["p-thrip","Slim fast insects in the flowers"]
  ]},
  { g:"Conditions", items:[
    ["soil-soggy","Soil stays wet / poor drainage"],
    ["soil-dry","Soil dries out between waterings"],
    ["recent-heat","Recent heat wave"],
    ["recent-cold","Recent cold snap or frost"],
    ["recent-rain","Long wet spell"],
    ["low-light","Gets less than 5h of direct sun"],
    ["fed-recently","Fertilized recently"],
    ["container","Growing in a container"],
    ["new-transplant","Transplanted in the last 2 weeks"],
    ["crowded","Crowded, poor airflow"]
  ]}
];

const CONDITIONS = [
/* --- nutrients --- */
{id:"n-def",n:"Nitrogen deficiency",k:"nutrient",sev:2,
 tags:{"yellow-old":3,"yellow-whole":2,"stunted":2,"pale":1},
 quick:"Classic pattern: the oldest, lowest leaves go uniformly yellow first while new growth stays green. Nitrogen is mobile, so the plant robs old leaves to feed new ones.",
 treat:["Fish emulsion or blood meal now — liquid feeds act within days.","Side-dress with finished compost or aged manure.","For a fast fix on greens, dilute fish emulsion 1 tbsp/gallon as a foliar spray."],
 prev:["Compost every bed at the start of the season.","Heavy feeders (corn, brassicas, tomatoes, squash) want a side-dressing mid-season.","Mulch with straw, not fresh wood chips — raw wood ties up nitrogen."]},
{id:"k-def",n:"Potassium deficiency",k:"nutrient",sev:2,
 tags:{"edges-brown":3,"yellow-old":2,"spots-brown":1,"misshapen-fruit":2},
 quick:"Browning and scorching that starts at the leaf margins of older leaves, working inward. Fruit sizes poorly and ripens unevenly.",
 treat:["Kelp meal, greensand or sulphate of potash worked into the top inch.","Wood ash in small amounts if your soil is not already alkaline.","Banana-peel compost is folklore-level slow — use a real amendment if the plant is fruiting."],
 prev:["Test soil every 2–3 years.","Sandy soils leach potassium fast — feed little and often."]},
{id:"p-def",n:"Phosphorus deficiency",k:"nutrient",sev:2,
 tags:{"purple-tint":3,"stunted":2,"no-set":1},
 quick:"Purple or reddish undersides and stems with stunted growth. Often it is not a shortage at all — cold soil simply stops roots taking phosphorus up.",
 treat:["If soil is under 60°F, wait and warm it — this usually fixes itself.","Bone meal or rock phosphate worked in near the roots.","Mycorrhizal inoculant at transplant improves uptake dramatically."],
 prev:["Do not transplant heat-lovers into cold soil.","Keep pH between 6.0 and 7.0 — phosphorus locks up outside that band."]},
{id:"mg-def",n:"Magnesium deficiency",k:"nutrient",sev:1,
 tags:{"yellow-veins":4,"yellow-old":2,"container":1},
 quick:"Yellowing between the veins of older leaves while the veins themselves stay green — a herringbone look. Common in containers and after heavy potassium feeding.",
 treat:["1 tbsp Epsom salt per gallon as a foliar spray; repeat in 2 weeks.","Dolomitic lime if your soil is also acidic."],
 prev:["Do not overdo potassium — it competes with magnesium.","Refresh container mix each year."]},
{id:"fe-def",n:"Iron chlorosis",k:"nutrient",sev:1,
 tags:{"yellow-new":4,"yellow-veins":3,"soil-soggy":1},
 quick:"Yellowing between veins on the NEWEST leaves. Iron is immobile, so deficiency shows up in new growth. Usually a pH problem, not a shortage.",
 treat:["Chelated iron as a foliar spray for a quick green-up.","Elemental sulphur to lower pH over time if soil is alkaline.","Improve drainage — waterlogged roots cannot take up iron."],
 prev:["Keep pH at or below 7.0 for most vegetables.","Avoid overwatering in heavy soils."]},
{id:"ca-ber",n:"Blossom end rot (calcium)",k:"nutrient",sev:2,
 crops:["tomato","pepper","hotpepper","eggplant","zucchini","wintersquash","watermelon"],
 tags:{"blossom-end":6,"soil-dry":2,"container":1,"fed-recently":1},
 quick:"A sunken leathery black patch on the bottom of the fruit. There is almost always plenty of calcium in the soil — inconsistent watering is what stops the plant moving it into the fruit.",
 treat:["Water deeply and evenly. This is the whole fix.","Mulch 2–3 inches to buffer soil moisture swings.","Remove affected fruit — it will not recover.","Skip the calcium spray; foliar calcium barely reaches fruit."],
 prev:["Consistent moisture, especially in containers and during heat.","Do not over-fertilize with nitrogen or potassium — both block calcium uptake.","Wide, deep containers hold moisture more evenly than narrow ones."]},
{id:"over-fert",n:"Fertilizer burn / salt build-up",k:"culture",sev:2,
 tags:{"tips-brown":3,"edges-brown":2,"fed-recently":4,"container":2,"wilting":1},
 quick:"Scorched leaf tips and margins shortly after feeding, often with a white crust on the soil surface. Excess salts pull water back out of the roots.",
 treat:["Flush the container or bed with plain water — 3× the pot volume.","Stop feeding for 3–4 weeks.","Scrape off any white crust on the surface."],
 prev:["Half-strength liquid feed twice as often beats full strength.","Always water before fertilizing, never onto dry soil."]},

/* --- water & environment --- */
{id:"overwater",n:"Overwatering / root rot",k:"environment",sev:3,
 tags:{"wilting":3,"yellow-whole":3,"soil-soggy":5,"stem-mushy":3,"collapse":2,"yellow-old":1,"container":1},
 quick:"Counterintuitively, an overwatered plant wilts — drowned roots cannot take up water. Leaves yellow all over and the base of the stem goes soft and dark.",
 treat:["Stop watering. Let the top 2 inches dry completely.","Improve drainage: raise the bed, add coarse compost, or repot with fresh mix.","Trim off any mushy black roots if you can lift the plant.","Do not fertilize a plant with damaged roots."],
 prev:["Water by finger test, not by schedule — 2 inches down should feel barely damp.","Deep and infrequent beats shallow and daily.","Containers must have drainage holes and must never sit in a saucer of water."]},
{id:"underwater",n:"Drought stress",k:"environment",sev:2,
 tags:{"wilting":3,"soil-dry":5,"edges-brown":2,"tips-brown":1,"recent-heat":2,"fruit-crack":1,"container":1},
 quick:"Wilting that recovers overnight, crisp brown edges, and soil that has pulled away from the sides of the bed or pot.",
 treat:["Water slowly and deeply until it runs out the bottom, then again an hour later.","For containers, bottom-water in a tub for 20 minutes to rewet hydrophobic mix.","Mulch immediately after watering."],
 prev:["2–3 inches of straw or leaf mulch cuts water use roughly in half.","Drip or soaker line on a timer.","Check containers twice daily in heat — they can dry in hours."]},
{id:"sunscald",n:"Sunscald",k:"environment",sev:1,
 tags:{"sunbleach":5,"recent-heat":3,"fruit-rot":1,"new-transplant":2},
 quick:"Bleached white or papery tan patches on the side facing the sun, on leaves or exposed fruit. Common on plants moved outside without hardening off, or after heavy pruning exposes fruit.",
 treat:["Shade cloth (30–40%) during afternoon peak for a week.","Stop pruning foliage — the leaves are the fruit's sunscreen.","Damaged tissue will not heal; remove badly scalded fruit."],
 prev:["Harden transplants off over 7–10 days.","Leave enough canopy over ripening fruit.","Shade cloth over peppers and lettuce in a heat wave."]},
{id:"lowlight",n:"Not enough sun",k:"environment",sev:2,
 tags:{"leggy":5,"low-light":5,"stunted":2,"no-set":2,"pale":2,"yellow-whole":1},
 quick:"Long stretched stems with wide gaps between leaves, leaning hard toward the light, few or no flowers. Fruiting crops need 6–8 hours of direct sun; below that they grow but do not produce.",
 treat:["Move containers to the sunniest spot you have.","Thin or prune whatever is casting shade.","Switch that bed to crops that genuinely tolerate shade: lettuce, spinach, arugula, kale, chard, mint, parsley."],
 prev:["Track real sun hours across a day before you plant a bed.","Put tall crops on the north side so they do not shade the rest."]},
{id:"frost",n:"Frost or cold damage",k:"environment",sev:2,
 tags:{"recent-cold":5,"collapse":2,"spots-brown":1,"wilting":2,"edges-brown":1,"distorted":1},
 quick:"Blackened, water-soaked, limp tissue the morning after a cold night. Tender crops — tomato, pepper, basil, squash, beans — are hit below about 40°F, hard frost kills them outright.",
 treat:["Wait 3–4 days before cutting anything; some tissue recovers.","Remove blackened growth once new growth appears.","Do not fertilize a cold-shocked plant."],
 prev:["Watch the 7-day forecast in the app and cover before a cold night.","Row cover, an old sheet, or a cloche bought over the top — not touching the leaves.","Water the soil before a frost night; moist soil holds heat."]},
{id:"transplant-shock",n:"Transplant shock",k:"culture",sev:1,
 tags:{"new-transplant":5,"wilting":3,"stunted":2,"yellow-old":1,"purple-tint":1},
 quick:"Wilting and a growth stall in the first week or two after planting out. Roots have been disturbed and cannot yet supply the leaves.",
 treat:["Shade for 3–4 days.","Water in well, then keep evenly moist but not soaked.","Pinch off any flowers so energy goes to roots.","Seaweed extract drench helps root recovery."],
 prev:["Harden off over 7–10 days.","Transplant in the evening or on an overcast day.","Disturb the root ball as little as possible."]},
{id:"heat-stress",n:"Heat stress / blossom drop",k:"environment",sev:1,
 tags:{"no-set":4,"recent-heat":4,"curl-up":2,"wilting":1,"bolting":2},
 quick:"Flowers open and fall without setting fruit. Tomato pollen goes sterile above roughly 90°F day / 75°F night; peppers and beans are similar.",
 treat:["Shade cloth over the hottest hours.","Keep water steady — do not let plants wilt.","Wait it out; the plant sets again when nights cool."],
 prev:["Choose heat-set varieties in hot climates.","Mulch heavily and water deeply in the morning.","Time the main planting so flowering misses your hottest weeks."]},
{id:"bolt",n:"Bolting",k:"culture",sev:1,
 tags:{"bolting":6,"recent-heat":3,"low-light":1},
 quick:"The plant switches to making seed — a flower stalk shoots up and leaves turn bitter. Triggered by heat, lengthening days, or stress in cool-season crops.",
 treat:["Harvest what is left immediately; it only gets more bitter.","Let one plant flower for the pollinators and save the seed.","Cilantro seed is coriander — worth keeping."],
 prev:["Plant cool-season crops for spring and fall, not summer.","Bolt-resistant varieties.","Afternoon shade and steady moisture buy you weeks."]},
{id:"poor-poll",n:"Poor pollination",k:"culture",sev:1,
 crops:["zucchini","cucumber","wintersquash","pumpkin","melon","watermelon","corn","tomato"],
 tags:{"no-set":4,"misshapen-fruit":4,"fruit-rot":2},
 quick:"Fruit starts, then yellows and shrivels at the tip, or grows lopsided. Squash and cucumbers need bees to move pollen from male to female flowers; corn needs wind and a block planting.",
 treat:["Hand-pollinate at dawn: pick a male flower, strip the petals, dab pollen onto the female's stigma.","Tomatoes are self-fertile — flick the flower trusses or use an electric toothbrush on the stem.","Plant borage, calendula, alyssum and let some herbs flower."],
 prev:["Never spray insecticide on open flowers.","Plant corn in blocks of at least 4×4, not single rows.","Keep flowering companions in every bed."]},

/* --- fungal & bacterial --- */
{id:"powdery",n:"Powdery mildew",k:"disease",sev:2,
 tags:{"white-powder":6,"crowded":2,"yellow-old":1,"recent-heat":1},
 quick:"White talc-like coating on the upper leaf surface, spreading to cover the leaf. Thrives in warm days, cool nights and humid, still air — unlike most fungi, it does not need leaf wetness.",
 treat:["Milk spray: 1 part milk to 2 parts water, weekly in the morning — genuinely effective early.","Potassium bicarbonate spray is the strongest organic option.","Remove and bin the worst leaves — do not compost them.","Neem oil works but never apply in heat or full sun."],
 prev:["Space plants for airflow and prune the lower 12 inches of squash and tomato leaves.","Water at the base in the morning.","Resistant varieties — the label is worth reading for squash and cucumbers."]},
{id:"downy",n:"Downy mildew",k:"disease",sev:3,
 tags:{"yellow-veins":2,"fuzzy-gray":4,"spots-brown":2,"recent-rain":3,"crowded":2},
 quick:"Angular yellow patches on top bounded by the veins, with gray-purple fuzz on the underside. Moves fast in cool wet weather and can strip a cucumber or basil planting in a week.",
 treat:["Remove affected leaves immediately and bin them.","Copper fungicide slows it; nothing cures it.","Improve airflow and stop overhead watering today."],
 prev:["Resistant varieties, especially for basil and cucumber.","Wide spacing, morning watering at the base.","Rotate — spores overwinter in debris."]},
{id:"early-blight",n:"Early blight",k:"disease",sev:2,
 crops:["tomato","potato","eggplant"],
 tags:{"spots-target":6,"spots-brown":3,"yellow-old":3,"recent-rain":2},
 quick:"Brown spots with concentric rings like a bullseye, starting on the lowest leaves and climbing. Soil-borne — rain splashes it up onto the plant.",
 treat:["Strip the affected lower leaves and bin them.","Mulch heavily to stop soil splash — this is the single most effective step.","Copper or Bacillus subtilis spray on remaining foliage.","Keep feeding; a vigorous plant outruns it."],
 prev:["Mulch at planting, before any rain hits bare soil.","Prune the lowest 12 inches of foliage.","Three-year rotation away from nightshades.","Cage or stake for airflow."]},
{id:"late-blight",n:"Late blight",k:"disease",sev:3,
 crops:["tomato","potato"],
 tags:{"spots-brown":3,"collapse":4,"fuzzy-gray":3,"recent-rain":4,"fruit-rot":3,"stem-lesion":3},
 quick:"Large greasy gray-green blotches that turn brown-black fast, white fuzz on the undersides in humid weather, and firm brown patches on fruit. This is the potato-famine disease and it destroys a planting in days.",
 treat:["Act immediately — remove and bag the whole plant if it is well established. Do not compost.","Copper fungicide protects healthy plants nearby but will not cure an infected one.","Harvest any clean green fruit right away.","Tell your neighbours; spores travel miles on the wind."],
 prev:["Never save potato tubers from an infected patch.","Resistant varieties in wet climates.","Keep foliage dry and spaced."]},
{id:"septoria",n:"Septoria leaf spot",k:"disease",sev:2,
 crops:["tomato"],
 tags:{"spots-halo":5,"spots-brown":3,"yellow-old":3,"recent-rain":2,"crowded":1},
 quick:"Many small round spots with dark borders and pale centres, on the lower leaves first. It does not usually touch the fruit but it can defoliate the plant.",
 treat:["Remove affected leaves as they appear.","Mulch to block soil splash.","Copper or Bacillus subtilis every 7–10 days in wet weather."],
 prev:["Mulch, space, stake.","Rotate out of nightshades for 3 years.","Clean up every scrap of tomato debris in autumn."]},
{id:"wilt-fung",n:"Fusarium / Verticillium wilt",k:"disease",sev:3,
 tags:{"wilt-one-side":6,"wilting":3,"yellow-old":2,"stunted":2},
 quick:"One branch or one side of the plant wilts in the heat of the day while the rest looks fine, then more follows. Cut the stem lengthwise — brown streaking inside the vascular tissue confirms it.",
 treat:["There is no cure. Remove and bin the plant to protect the rest.","Do not replant the same family in that spot.","Keep remaining plants unstressed and well watered."],
 prev:["Buy varieties labelled V and F resistant.","Long rotations; solarize badly infected beds.","Raise soil organic matter — healthy soil biology suppresses it."]},
{id:"damping-off",n:"Damping off",k:"disease",sev:3,
 tags:{"seedling-fell":6,"stem-mushy":3,"soil-soggy":3,"collapse":2},
 quick:"Healthy seedlings topple at the soil line and the stem looks pinched and water-soaked. A soil fungus that only attacks very young stems in wet, still, cold conditions.",
 treat:["Nothing saves a fallen seedling. Remove it so it does not spread.","Cut watering back hard, bottom-water only.","Put a small fan on the tray — air movement stops it cold.","Sprinkle cinnamon or chamomile tea on the surface as a mild fungistat."],
 prev:["Sterile seed-starting mix, clean trays.","Do not sow too deep or too thick.","Bottom heat, good light, and a fan from day one."]},
{id:"botrytis",n:"Botrytis / gray mould",k:"disease",sev:2,
 tags:{"fuzzy-gray":5,"fruit-rot":3,"recent-rain":3,"crowded":3,"stem-lesion":2},
 quick:"Fuzzy gray-brown mould on dying flowers, fruit and stems in cool damp conditions. It enters through dead tissue, then moves into healthy tissue.",
 treat:["Remove all dead flowers, leaves and rotting fruit — that is its entry point.","Increase airflow, drop the humidity.","Bin, never compost, infected material."],
 prev:["Deadhead and clean up promptly.","Space plants; prune for airflow.","Avoid overhead watering late in the day."]},
{id:"rust",n:"Rust",k:"disease",sev:2,
 tags:{"rust-orange":6,"spots-brown":1,"yellow-old":2,"recent-rain":2},
 quick:"Raised orange, brown or reddish pustules, usually on the undersides of leaves; they release a rusty powder when rubbed.",
 treat:["Remove affected leaves and bin them.","Sulphur or copper spray on the rest.","Cut watering back and improve airflow."],
 prev:["Resistant varieties; wide spacing.","Water at the base early in the day.","Autumn clean-up — rust overwinters on debris."]},
{id:"bact-spot",n:"Bacterial leaf spot",k:"disease",sev:2,
 tags:{"spots-halo":4,"spots-brown":3,"recent-rain":3,"spots-black":3},
 quick:"Small dark greasy-looking spots, often angular and sometimes with a yellow halo, spreading fast after storms. Bacteria enter through wounds and water films.",
 treat:["Remove affected leaves; do not work among wet plants.","Copper spray limits spread but will not cure it.","Sterilize pruners between plants with alcohol."],
 prev:["Buy certified clean seed; hot-water treat saved seed.","Drip irrigation, never overhead.","Three-year rotation and thorough debris clean-up."]},

/* --- pests --- */
{id:"aphid",n:"Aphids",k:"pest",sev:2,
 tags:{"p-aphid":6,"sticky":4,"sooty":3,"curl-down":3,"distorted":3,"stunted":1,"yellow-new":1},
 quick:"Dense clusters of soft pear-shaped insects on new growth and leaf undersides, leaving sticky honeydew that then grows black sooty mould. They curl and distort new leaves.",
 treat:["Blast them off with a hard jet of water — repeat daily for 3 days and that alone often ends it.","Insecticidal soap or 1 tsp mild soap per quart of water, sprayed on the undersides.","Release or attract ladybirds and hoverflies.","Pinch off the worst-infested growing tips."],
 prev:["Plant alyssum, dill, fennel and calendula to feed hoverflies and parasitic wasps.","Nasturtium as a trap crop pulls them off your brassicas.","Avoid excess nitrogen — soft lush growth is exactly what they want."]},
{id:"spidermite",n:"Spider mites",k:"pest",sev:3,
 tags:{"stippling":6,"webbing":6,"p-mite":5,"recent-heat":3,"yellow-whole":2,"soil-dry":2},
 quick:"Fine pale speckling across the leaf, then fine webbing in the leaf axils. The mites are barely visible — tap a leaf over white paper and look for moving dust. They explode in hot dry conditions.",
 treat:["Spray the undersides hard with water; mites hate humidity.","Insecticidal soap or horticultural oil, three applications 5 days apart to catch the hatch.","Remove and bin the worst leaves.","Predatory mites work well in greenhouses."],
 prev:["Keep plants well watered and mist in dry heat.","Avoid broad-spectrum insecticides — they kill the predators first.","Quarantine new plants for a week."]},
{id:"whitefly",n:"Whiteflies",k:"pest",sev:2,
 tags:{"p-whitefly":6,"sticky":3,"sooty":2,"yellow-whole":2,"stunted":1},
 quick:"A cloud of tiny white insects lifts off when you brush the plant. Nymphs on the leaf undersides do the real damage and leave honeydew behind.",
 treat:["Yellow sticky traps just above the canopy.","Insecticidal soap on the undersides, twice a week.","Vacuum the adults in the cool of early morning — it sounds absurd and works."],
 prev:["Inspect nursery plants before bringing them home.","Reflective mulch confuses them.","Encourage lacewings and parasitic wasps."]},
{id:"flea-beetle",n:"Flea beetles",k:"pest",sev:2,
 crops:["eggplant","radish","arugula","bokchoy","mustard","turnip","kale","cabbage","broccoli","potato"],
 tags:{"p-flea":6,"holes":4},
 quick:"Leaves peppered with tiny round shot-holes, and small black beetles that jump like fleas when you get close. Devastating on seedlings, survivable on established plants.",
 treat:["Floating row cover — the only reliable answer. Seal the edges.","Yellow sticky traps at plant height.","Kaolin clay spray makes leaves unappealing.","Push seedlings hard with water and feed so they outgrow the damage."],
 prev:["Cover from the day of sowing until plants are large.","Delay planting a couple of weeks past peak emergence.","Trap crop of radish or mustard nearby."]},
{id:"cabbageworm",n:"Cabbage worms / loopers",k:"pest",sev:2,
 crops:["cabbage","broccoli","cauliflower","kale","brussels","collards","kohlrabi","bokchoy","arugula","mustard"],
 tags:{"p-caterpillar":6,"holes":4,"edges-chewed":3,"skeletonized":2},
 quick:"Velvety green caterpillars matching the leaf colour, ragged holes, and dark green pellets of frass in the crown. The parent is the white butterfly you have been watching.",
 treat:["Hand-pick — most effective in the evening.","Bt (Bacillus thuringiensis) is specific to caterpillars and safe for bees; reapply after rain.","Check the leaf undersides for yellow egg clusters and crush them."],
 prev:["Row cover from transplant until harvest.","Interplant thyme, sage, dill and nasturtium.","A few decoy white butterflies genuinely deter egg-laying — the females are territorial."]},
{id:"hornworm",n:"Tomato hornworm",k:"pest",sev:2,
 crops:["tomato","pepper","eggplant","potato"],
 tags:{"p-hornworm":6,"skeletonized":4,"edges-chewed":2,"holes":2},
 quick:"Whole branches stripped overnight, large black droppings on the leaves below, and a 3–4 inch green caterpillar hiding in plain sight. Look at night with a UV torch — they glow.",
 treat:["Hand-pick. One or two can defoliate a plant.","If you see white rice-like cocoons on its back, LEAVE IT — those are parasitic wasps that will kill it and breed more.","Bt works on the small ones."],
 prev:["Till the bed in autumn to expose overwintering pupae.","Plant dill and borage to host the parasitic wasps.","Check plants every few days in midsummer."]},
{id:"squashbug",n:"Squash bugs",k:"pest",sev:3,
 crops:["zucchini","wintersquash","pumpkin","cucumber","melon","watermelon"],
 tags:{"p-squashbug":6,"wilting":3,"spots-brown":2,"collapse":2},
 quick:"Flat gray-brown shield-shaped bugs and bronze egg clusters in neat rows on leaf undersides. They inject a toxin that wilts the vine, and adults are almost impossible to kill with sprays.",
 treat:["Scrape the egg clusters off with a butter knife or tape — this is the whole battle.","Lay a board next to the plant overnight; they gather under it and you can dispatch them at dawn.","Soap spray kills only the young nymphs."],
 prev:["Row cover until flowering, then remove for pollination.","Clean up all vines and debris in autumn.","Resistant squash types — butternut and moschata varieties shrug them off."]},
{id:"vine-borer",n:"Squash vine borer",k:"pest",sev:3,
 crops:["zucchini","wintersquash","pumpkin"],
 tags:{"wilting":4,"collapse":5,"stem-lesion":4,"stem-mushy":3},
 quick:"A healthy squash plant wilts suddenly and never recovers. Look at the base for a hole with sawdust-like frass — a grub is inside the stem.",
 treat:["Slit the stem lengthwise with a razor, remove the grub, then bury that section in soil so it re-roots.","Inject Bt into the stem with a syringe.","Bury several nodes along the vine as insurance — each one roots independently."],
 prev:["Wrap the bottom 6 inches of stem in foil or nylon in early summer.","Row cover until flowering.","Plant a second crop in midsummer to outrun the single generation.","Butternut and other moschata squash have solid stems and resist it."]},
{id:"cucbeetle",n:"Cucumber beetles",k:"pest",sev:3,
 crops:["cucumber","zucchini","wintersquash","pumpkin","melon","watermelon"],
 tags:{"p-cucbeetle":6,"holes":3,"wilting":3,"collapse":2},
 quick:"Yellow beetles with black stripes or spots chewing flowers and leaves. The real danger is not the chewing — they transmit bacterial wilt, which kills the vine outright.",
 treat:["Hand-pick in the cool of early morning when they are sluggish.","Yellow sticky traps.","Kaolin clay coating.","Pull and bin any plant that wilts from bacterial wilt — cut a stem, and if the sap strings when pulled apart, it is confirmed."],
 prev:["Row cover until flowering.","Delay planting past the first emergence.","Straw mulch disrupts their soil-dwelling larvae.","Perimeter trap crop of Blue Hubbard squash works remarkably well."]},
{id:"slug",n:"Slugs and snails",k:"pest",sev:2,
 tags:{"slime":6,"holes":4,"edges-chewed":3,"recent-rain":3,"seedling-fell":1},
 quick:"Irregular holes with smooth edges, silvery slime trails, worst after rain and overnight. They shelter under mulch and boards during the day.",
 treat:["Iron phosphate bait is safe around pets and wildlife.","Beer traps sunk to soil level.","Hand-pick after dark with a torch — brutally effective.","Copper tape around containers and raised beds."],
 prev:["Water in the morning so the surface is dry by nightfall.","Pull mulch back from the stems of vulnerable seedlings.","Encourage birds, frogs and ground beetles."]},
{id:"thrips",n:"Thrips",k:"pest",sev:2,
 tags:{"p-thrip":5,"silver-streaks":6,"distorted":3,"stippling":2},
 quick:"Silvery streaks and scarring with tiny black specks of frass, and slim fast-moving insects inside the flowers. They also transmit viruses.",
 treat:["Blue sticky traps.","Insecticidal soap or spinosad, repeated weekly.","Remove badly affected flowers and buds."],
 prev:["Keep weeds down around beds.","Reflective mulch.","Encourage minute pirate bugs and lacewings."]},
{id:"leafminer",n:"Leaf miners",k:"pest",sev:1,
 tags:{"tunnels":6,"spots-brown":1},
 quick:"Pale winding tunnels between the leaf surfaces, made by a larva feeding inside the leaf. Ugly but rarely fatal on established plants.",
 treat:["Pick off and bin mined leaves — the larva goes with them.","Squash the larva at the end of the tunnel with your fingernail.","Sprays do not reach inside the leaf; do not bother."],
 prev:["Row cover on spinach, chard and beets.","Clean up debris; they pupate in the soil.","Parasitic wasps handle them if you do not spray."]},
{id:"japanese",n:"Japanese beetles",k:"pest",sev:2,
 tags:{"p-japanese":6,"skeletonized":5,"holes":3},
 quick:"Metallic green and copper beetles feeding in groups, leaving leaves skeletonized to a lace of veins.",
 treat:["Knock them into soapy water in the early morning.","Do NOT hang pheromone traps near the garden — they attract far more than they catch.","Neem disrupts feeding over time."],
 prev:["Milky spore or beneficial nematodes on the lawn to hit the grubs.","Row cover during the 6-week peak.","Keep plants healthy; they favour stressed tissue."]},

/* --- other --- */
{id:"mosaic-virus",n:"Mosaic virus",k:"disease",sev:3,
 tags:{"mosaic":6,"distorted":3,"stunted":3,"misshapen-fruit":2,"p-aphid":1},
 quick:"Mottled light and dark green patchwork, puckered or strap-like leaves, stunted growth. Spread by aphids, thrips and on hands and tools — there is no cure.",
 treat:["Remove and bin the plant to protect the rest. Do not compost.","Wash hands and sterilize tools with 10% bleach or alcohol.","Control aphids and thrips, which vector it."],
 prev:["Resistant varieties.","Do not handle plants after tobacco.","Control sucking insects; keep weeds down."]},
{id:"herbicide",n:"Herbicide drift or contaminated compost",k:"culture",sev:3,
 tags:{"distorted":6,"curl-down":3,"curl-up":3,"stunted":3},
 quick:"Twisted, cupped, fern-like or strap-shaped new growth with no pest or spot visible. Tomatoes are exquisitely sensitive. Comes from spray drift or from manure and hay contaminated with persistent broadleaf herbicides.",
 treat:["Mild drift: the plant often grows out of it — keep it watered and wait.","Severe: pull it; fruit from badly affected plants is not worth eating.","If you suspect compost, bio-assay it — sow beans in it and watch."],
 prev:["Never use hay, straw or manure from unknown sources on vegetable beds.","Buffer rows or a hedge on the windward side.","Talk to neighbours about spray timing."]},
{id:"ph-lock",n:"pH lockout",k:"culture",sev:2,
 tags:{"yellow-new":3,"yellow-whole":2,"stunted":3,"purple-tint":2,"pale":2},
 quick:"Deficiency symptoms across several nutrients at once even though you have fertilized. Outside pH 6.0–7.0 the nutrients are present but chemically unavailable.",
 treat:["Test the soil — a $15 meter or a mail-in test pays for itself.","Too acidic: garden lime, applied in autumn for spring.","Too alkaline: elemental sulphur, plus compost and pine fines."],
 prev:["Test every 2–3 years.","Compost buffers pH naturally.","Match crops to your soil — blueberries and potatoes want it acidic, brassicas want it sweeter."]},
{id:"crowding",n:"Overcrowding",k:"culture",sev:1,
 tags:{"crowded":6,"leggy":3,"stunted":3,"white-powder":1,"fuzzy-gray":1,"yellow-old":2},
 quick:"Plants competing for light, water and nutrients — thin weak growth, poor yields and a humid canopy that invites every fungal disease going.",
 treat:["Thin now, even though it feels wasteful. Two good plants beat six poor ones.","Prune the lower foliage for airflow.","Feed and water the survivors well."],
 prev:["Follow the spacing on the packet, not your optimism.","Use the app's per-square plant counts.","Succession sow instead of cramming one planting."]}
];

const Doctor = {
  photoId: null, analysis: null, picked: {}, stream: null,

  render(){
    const box = $("#s-doctor");
    const hist = DB.all("diagnoses").sort((a,b) => (b.date || "").localeCompare(a.date || ""));
    let h = '';

    h += '<div class="card"><div class="row between" style="margin-bottom:10px"><div><div class="b">Scan a plant</div>' +
      '<div class="tiny muted">Photograph a leaf, then answer a few questions.</div></div><div style="font-size:2rem">🔬</div></div>' +
      '<div id="dc-cam"></div>' +
      '<div class="row" style="gap:8px;margin-top:10px">' +
        '<button class="btn grow" onclick="Doctor.startCamera()">📷 Open camera</button>' +
        '<button class="btn ghost grow" onclick="Doctor.pick(true)">Snapshot</button>' +
        '<button class="btn ghost" onclick="Doctor.pick(false)">🖼️</button></div>' +
      '<button class="btn outline block" style="margin-top:10px" onclick="Doctor.triage()">Skip the photo — describe symptoms</button>' +
      '</div>';

    h += '<div class="note i" style="margin-top:12px"><b>How this works.</b> The app measures colour and pattern in your photo on-device, then combines that with your answers against ' +
      CONDITIONS.length + ' known problems. Nothing is uploaded unless you turn on AI diagnosis in Settings.</div>';

    h += '<div class="sec"><h2>Diagnosis history</h2><span class="tiny muted">' + hist.length + '</span></div>';
    if(!hist.length) h += '<div class="card center muted sm">No scans yet.</div>';
    else {
      h += '<div class="card pad0"><div class="list">';
      hist.slice(0, 25).forEach(d => {
        const u = Photos.url(d.photo_id);
        h += '<button class="item" onclick="Doctor.openHistory(\'' + d.id + '\')">' +
          '<div class="av">' + (u ? '<img src="' + u + '">' : "🔬") + '</div>' +
          '<div class="grow"><div class="b truncate">' + esc(d.result || "Unresolved") + '</div>' +
          '<div class="tiny muted">' + fmt(d.date) + (d.crop_id ? ' · ' + esc(cropName(d.crop_id)) : '') +
          (d.confidence ? ' · ' + esc(d.confidence) + '% match' : '') + '</div></div><span class="go">›</span></button>';
      });
      h += '</div></div>';
    }
    box.innerHTML = h;
  },

  /* ---------- camera ---------- */
  async startCamera(){
    const wrap = $("#dc-cam");
    if(!Cam.supported()){
      toast("Live camera needs https — using your camera app instead"); return Doctor.pick(true);
    }
    try{
      Doctor.stopCamera();
      Doctor.stream = await Cam.rear();
      wrap.innerHTML = '<video id="camfeed" playsinline autoplay muted></video>' +
        '<button class="btn block" style="margin-top:8px" onclick="Doctor.snap()">◉ Capture</button>' +
        '<button class="btn ghost block sm" style="margin-top:6px" onclick="Doctor.stopCamera();Doctor.render()">Close camera</button>';
      const v = $("#camfeed"); v.srcObject = Doctor.stream; await v.play();
    }catch(e){
      toast("Camera blocked — using your photo library"); Doctor.pick(true);
    }
  },
  stopCamera(){ Cam.stop(Doctor.stream); Doctor.stream = null; },
  snap(){
    const v = $("#camfeed"); if(!v) return;
    const s = Math.min(1, 900 / Math.max(v.videoWidth, v.videoHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(v.videoWidth * s); c.height = Math.round(v.videoHeight * s);
    c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
    Doctor.stopCamera();
    Doctor.gotImage(c.toDataURL("image/jpeg", 0.78), c);
  },
  pick(useCamera){
    const inp = useCamera ? $("#filepick-cam") : $("#filepick");
    inp.value = "";
    inp.onchange = async () => {
      const f = inp.files[0]; if(!f) return;
      try{ const r = await shrinkImage(f, 900, 0.78); Doctor.gotImage(r.dataUrl, r.canvas); }
      catch(e){ toast("Could not read that image"); }
    };
    inp.click();
  },
  gotImage(dataUrl, canvas){
    if(Doctor.photoId) Photos.drop(Doctor.photoId);
    Doctor.photoId = Photos.put(dataUrl, canvas.width, canvas.height);
    Doctor.analysis = Doctor.analyze(canvas);
    Doctor.triage();
  },

  /* ---------- on-device image analysis ---------- */
  analyze(canvas){
    const W = 180, H = Math.max(1, Math.round(canvas.height / canvas.width * W));
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const ctx = c.getContext("2d"); ctx.drawImage(canvas, 0, 0, W, H);
    let d; try{ d = ctx.getImageData(0, 0, W, H).data; }catch(e){ return null; }
    let leaf = 0, green = 0, yellow = 0, brown = 0, white = 0, dark = 0, edgeBrown = 0, edgeTot = 0;
    let sumV = 0, sumSat = 0;
    for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){
      const i = (y * W + x) * 4, r = d[i], g = d[i+1], b = d[i+2];
      const mx = Math.max(r,g,b), mn = Math.min(r,g,b), v = mx / 255, sat = mx ? (mx - mn) / mx : 0;
      const isEdge = (x < W*0.12 || x > W*0.88 || y < H*0.12 || y > H*0.88);
      const isGreen = (g > r + 8 && g > b + 8);
      const isYellow = (r > 110 && g > 110 && b < g - 35 && !isGreen);
      const isBrown = (r > g && g >= b && v < 0.62 && sat > 0.18);
      const isWhite = (sat < 0.14 && v > 0.72);
      const isDark = (v < 0.20);
      if(isGreen || isYellow || isBrown){ leaf++; sumV += v; sumSat += sat;
        if(isGreen) green++; else if(isYellow) yellow++; else brown++;
        if(isEdge){ edgeTot++; if(isBrown || isYellow) edgeBrown++; }
      } else if(isWhite) white++;
      else if(isDark) dark++;
    }
    const tot = W * H;
    const pct = n => Math.round(n / Math.max(1, leaf) * 100);
    return {
      leafCoverage: Math.round(leaf / tot * 100),
      green: pct(green), yellow: pct(yellow), brown: pct(brown),
      whitish: Math.round(white / tot * 100), dark: Math.round(dark / tot * 100),
      edgeBrown: edgeTot ? Math.round(edgeBrown / edgeTot * 100) : 0,
      vigor: leaf ? Math.round(sumSat / leaf * 100) : 0,
      brightness: leaf ? Math.round(sumV / leaf * 100) : 0
    };
  },
  autoTags(a){
    const t = {};
    if(!a) return t;
    if(a.yellow > 28) t["yellow-whole"] = 1;
    if(a.brown > 18) t["spots-brown"] = 1;
    if(a.edgeBrown > 42 && a.brown > 8) t["edges-brown"] = 1;
    if(a.whitish > 14) t["white-powder"] = 1;
    if(a.dark > 12 && a.brown > 6) t["spots-black"] = 1;
    if(a.green < 45 && a.yellow > 20) t["pale"] = 1;
    return t;
  },

  /* ---------- triage sheet ---------- */
  triage(){
    Doctor.picked = Object.assign({}, Doctor.autoTags(Doctor.analysis));
    const a = Doctor.analysis;
    let h = '';
    if(Doctor.photoId) h += '<img class="photo" src="' + Photos.url(Doctor.photoId) + '" style="max-height:230px;object-fit:cover;margin-bottom:10px">';
    if(a){
      h += '<div class="note i" style="margin-bottom:12px"><b>Image reading.</b> ' +
        'Healthy green ' + a.green + '% · yellowing ' + a.yellow + '% · browning ' + a.brown + '%' +
        (a.whitish > 8 ? ' · whitish film ' + a.whitish + '%' : '') +
        (a.edgeBrown > 35 ? '<br>Damage is concentrated at the leaf margins.' : '') +
        (a.green > 78 && a.brown < 6 ? '<br>Foliage colour looks healthy — if something is wrong it may be at the root, the fruit, or a pest.' : '') +
        '<br><span class="tiny">Colour analysis only. It cannot identify a species or a pathogen — your answers below do the real work.</span></div>';
    }
    h += '<div class="field"><label class="f">Which plant?</label><div class="row" style="gap:8px">' +
      '<select id="dx-plant"><option value="">— not specified —</option>' +
      DB.where("plantings", p => p.status !== "removed").map(p => {
        const b = DB.find("beds", p.bed_id);
        return '<option value="' + p.id + '">' + esc(cropName(p.crop_id)) + ' · ' + esc(b ? b.name : "?") + ' (r' + (num(p.y)+1) + 'c' + (num(p.x)+1) + ')</option>';
      }).join("") + '</select></div></div>';
    h += '<div class="field"><label class="f">…or just the crop</label><select id="dx-crop"><option value="">— not specified —</option>' +
      CROPS.map(c => '<option value="' + c.id + '">' + esc(c.n) + '</option>').join("") + '</select></div>';

    h += '<p class="tiny muted" style="margin:14px 0 6px">Tick everything you can see. The more you tick, the sharper the answer.</p>';
    SYMPTOMS.forEach(gr => {
      h += '<div class="b tiny muted" style="margin:12px 0 6px;text-transform:uppercase;letter-spacing:.06em">' + esc(gr.g) + '</div><div class="row wrap" style="gap:6px">';
      gr.items.forEach(it => h += '<button class="chip sym ' + (Doctor.picked[it[0]] ? "on" : "") + '" data-s="' + it[0] + '">' + esc(it[1]) + '</button>');
      h += '</div>';
    });
    h += '<button class="btn block" style="margin-top:18px" onclick="Doctor.diagnose()">Diagnose</button>';
    if(Vision.ready() && Doctor.photoId)
      h += '<button class="btn outline block" style="margin-top:8px" onclick="Doctor.aiDiagnose()">✨ Also ask ' + esc(Vision.who()) + ' to look at the photo</button>';
    h += '<div id="dx-aistatus" style="margin-top:8px"></div>';
    openSheet("What are you seeing?", h, () => Doctor.stopCamera());
    $$("#sheet-body .chip.sym").forEach(el => el.onclick = () => {
      const k = el.dataset.s;
      if(Doctor.picked[k]) delete Doctor.picked[k]; else Doctor.picked[k] = 1;
      el.classList.toggle("on"); haptic();
    });
  },

  /* ---------- rules engine ---------- */
  score(){
    const picked = Doctor.picked;
    const cropId = ($("#dx-crop") ? $("#dx-crop").value : "") ||
      (($("#dx-plant") && $("#dx-plant").value) ? (DB.find("plantings", $("#dx-plant").value) || {}).crop_id : "");
    const keys = Object.keys(picked);
    const out = CONDITIONS.map(c => {
      let hit = 0, max = 0, matched = [];
      Object.keys(c.tags).forEach(t => { max += c.tags[t]; });
      keys.forEach(k => { if(c.tags[k]){ hit += c.tags[k]; matched.push(k); } });
      let conf = max ? (hit / Math.max(max * 0.55, 1)) * 100 : 0;
      if(c.crops && cropId){ conf = c.crops.indexOf(cropId) >= 0 ? conf * 1.25 : conf * 0.55; }
      if(matched.length === 1 && keys.length > 2) conf *= 0.7;
      conf = Math.round(clamp(conf, 0, 97));
      return { c: c, conf: conf, matched: matched, hits: matched.length };
    }).filter(r => r.conf > 12).sort((a,b) => b.conf - a.conf);
    return { list: out, cropId: cropId };
  },

  diagnose(){
    const keys = Object.keys(Doctor.picked);
    if(!keys.length) return toast("Tick at least one symptom");
    const res = Doctor.score();
    const top = res.list.slice(0, 4);
    const plantingId = $("#dx-plant") ? $("#dx-plant").value : "";
    let h = '';
    if(Doctor.photoId) h += '<img class="photo" src="' + Photos.url(Doctor.photoId) + '" style="max-height:180px;object-fit:cover;margin-bottom:12px">';

    if(!top.length){
      h += '<div class="note w">Nothing in the knowledge base matches that combination well. Try adding a couple more observations, or photograph the underside of a leaf and the base of the stem.</div>';
    }
    top.forEach((r, i) => {
      const c = r.c;
      const cls = c.sev >= 3 ? "d" : c.sev === 2 ? "w" : "g";
      h += '<div class="card" style="margin-bottom:12px">';
      h += '<div class="row between"><div class="grow"><div class="b" style="font-size:1.05rem">' + (i === 0 ? "Most likely: " : "") + esc(c.n) + '</div>' +
        '<div class="tiny muted">' + esc(({nutrient:"Nutrient", disease:"Disease", pest:"Pest", environment:"Environment", culture:"Growing practice"})[c.k]) +
        ' · ' + (c.sev >= 3 ? "act now" : c.sev === 2 ? "treat soon" : "minor") + '</div></div>' +
        '<div class="stat" style="text-align:right"><span class="n">' + r.conf + '%</span><span class="l">match</span></div></div>';
      h += '<div class="bar-track" style="margin:8px 0"><div class="bar-fill" style="width:' + r.conf + '%;background:' +
        (c.sev >= 3 ? "var(--danger)" : c.sev === 2 ? "var(--warn)" : "var(--green-600)") + '"></div></div>';
      h += '<p class="sm" style="margin:8px 0">' + escU(c.quick) + '</p>';
      h += '<div class="note ' + cls + '"><b>What to do now</b><ul style="margin:6px 0 0;padding-left:18px">' +
        c.treat.map(t => '<li style="margin-bottom:4px">' + escU(t) + '</li>').join("") + '</ul></div>';
      h += '<details style="margin-top:8px"><summary class="sm b" style="cursor:pointer">Stop it happening again</summary>' +
        '<ul class="sm" style="margin:8px 0 0;padding-left:18px">' + c.prev.map(t => '<li style="margin-bottom:4px">' + escU(t) + '</li>').join("") + '</ul></details>';
      if(CLAIM_NOTES[c.id]) h += '<div class="note i" style="margin-top:8px"><b>Worth knowing.</b> ' + escU(CLAIM_NOTES[c.id]) + '</div>';
      if(c.src && c.src.length) h += '<div style="margin-top:10px">' + c.src.map(s =>
        '<a class="chip info" style="margin:0 6px 6px 0" href="' + esc(s[1]) + '" target="_blank" rel="noopener noreferrer">🔗 ' + esc(s[0]) + ' ↗</a>').join("") + '</div>';
      h += '</div>';
    });

    if(top.length > 1 && top[0].conf - top[1].conf < 12)
      h += '<div class="note i">Top two are close. Look for the distinguishing sign: ' +
        esc(top[0].c.n) + ' vs ' + esc(top[1].c.n) + ' — check leaf undersides, the stem base, and whether new or old growth is affected first.</div>';

    h += '<div class="note w" style="margin-top:12px">This is pattern-matching against a symptom library, not a lab test. Each diagnosis links to the extension service that published the guidance, so you can check it directly. For anything that could spread — late blight, bacterial wilt, a virus — get a real identification.</div>' +
      '<a class="btn ghost block" style="margin-top:8px" href="https://ask.extension.org/" target="_blank" rel="noopener noreferrer">Ask your local extension office ↗</a>';

    h += '<button class="btn block" style="margin-top:14px" onclick="Doctor.saveDx(\'' + (top[0] ? top[0].c.id : "") + '\',' + (top[0] ? top[0].conf : 0) + ',\'' + esc(plantingId) + '\')">Save to plant history</button>';
    h += '<button class="btn ghost block" style="margin-top:8px" onclick="Doctor.triage()">← Change my answers</button>';
    openSheet("Diagnosis", h);
  },

  saveDx(condId, conf, plantingId){
    const c = CONDITIONS.find(x => x.id === condId);
    const p = plantingId ? DB.find("plantings", plantingId) : null;
    const cropId = ($("#dx-crop") ? $("#dx-crop").value : "") || (p ? p.crop_id : null);
    DB.insert("diagnoses", {
      date: iso(today()), photo_id: Doctor.photoId, planting_id: plantingId || null,
      bed_id: p ? p.bed_id : null, crop_id: cropId,
      symptoms: Object.keys(Doctor.picked).join(","), result: c ? c.n : "Unresolved",
      confidence: conf, treatment: c ? c.treat.join(" | ") : "", source: "rules"
    });
    Doctor.photoId = null; Doctor.analysis = null; Doctor.picked = {};
    closeSheet(); Doctor.render(); toast("Saved to plant history");
  },

  openHistory(id){
    const d = DB.find("diagnoses", id); if(!d) return;
    const u = Photos.url(d.photo_id);
    const c = CONDITIONS.find(x => x.n === d.result);
    let h = '';
    if(u) h += '<img class="photo" src="' + u + '" style="max-height:240px;object-fit:cover;margin-bottom:12px">';
    h += '<div class="b" style="font-size:1.1rem">' + esc(d.result) + '</div>' +
      '<div class="tiny muted">' + fmtY(d.date) + (d.crop_id ? ' · ' + esc(cropName(d.crop_id)) : '') +
      (d.confidence ? ' · ' + esc(d.confidence) + '% match' : '') + ' · ' + esc(d.source === "ai" ? "AI vision" : "symptom rules") + '</div>';
    if(d.treatment) h += '<div class="note g" style="margin-top:12px"><b>Treatment given</b><ul style="margin:6px 0 0;padding-left:18px">' +
      d.treatment.split(" | ").map(t => '<li style="margin-bottom:4px">' + escU(t) + '</li>').join("") + '</ul></div>';
    if(d.notes) h += '<div class="note i" style="margin-top:8px">' + esc(d.notes) + '</div>';
    if(c) h += '<details style="margin-top:10px"><summary class="sm b">Prevention</summary><ul class="sm" style="padding-left:18px">' +
      c.prev.map(t => '<li>' + escU(t) + '</li>').join("") + '</ul></details>';
    h += '<button class="btn ghost block danger" style="margin-top:14px" onclick="Photos.drop(\'' + (d.photo_id||"") + '\');DB.remove(\'diagnoses\',\'' + d.id + '\');closeSheet();Doctor.render()">Delete this record</button>';
    openSheet("Scan record", h);
  },

  /* ---------- optional AI vision ---------- */
  async aiDiagnose(){
    if(!Vision.ready()) return Assist.setup();
    if(!Doctor.photoId) return toast("Take a photo first");
    const cropId = $("#dx-crop") ? $("#dx-crop").value : "";
    const syms = Object.keys(Doctor.picked).join(", ");
    const status = $("#dx-aistatus");
    if(status) status.innerHTML = '<div class="note i sm"><span class="spinner"></span> Asking ' + esc(Vision.who()) + ' to look at the photo…</div>';
    try{
      const txt = await Vision.ask(Doctor.photoId,
        "You are a plant pathologist helping a home gardener." +
        (cropId ? " The crop is " + cropName(cropId) + "." : "") +
        (syms ? " They report: " + syms + "." : "") +
        " Give: 1) the most likely diagnosis with a confidence percentage, 2) two alternatives worth ruling out and how to tell them apart, " +
        "3) what to do in the next 48 hours, 4) prevention. Be concrete and brief. If the photo is too unclear to judge, say so plainly.",
        /* four sections of prose, from a model that thinks out of the same
           budget it answers from. 900 was enough for neither. */
        { maxTokens: 2600 });
      if(!txt) throw new Error("empty");
      const html = esc(txt).replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>");
      openSheet("AI diagnosis",
        (Doctor.photoId ? '<img class="photo" src="' + Photos.url(Doctor.photoId) + '" style="max-height:200px;object-fit:cover;margin-bottom:12px">' : '') +
        '<div class="sm"><p>' + html + '</p></div>' +
        '<div class="note w" style="margin-top:12px">AI vision can be confidently wrong about plant disease. Cross-check against the symptom diagnosis before you spray anything.</div>' +
        '<button class="btn block" style="margin-top:12px" id="ai-save">Save to plant history</button>' +
        '<button class="btn ghost block" style="margin-top:8px" onclick="Doctor.triage()">← Back to symptoms</button>');
      $("#ai-save").onclick = () => {
        DB.insert("diagnoses", { date: iso(today()), photo_id: Doctor.photoId, crop_id: cropId || null,
          symptoms: syms, result: txt.split("\n")[0].slice(0, 90), treatment: "", notes: txt, source:"ai" });
        Doctor.photoId = null; Doctor.picked = {}; closeSheet(); Doctor.render(); toast("Saved");
      };
    }catch(e){
      const msg = Vision.explain(e);
      const st = $("#dx-aistatus");
      if(st) st.innerHTML = '<div class="note d sm"><b>Could not get an AI opinion.</b><br>' + esc(msg) +
        '</div><div class="tiny muted" style="margin-top:6px">The symptom-based diagnosis above works without it.</div>';
      else toast(msg);
    }
  }
};
</script>
