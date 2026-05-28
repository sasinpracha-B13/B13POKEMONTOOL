/* ============================================================
 * STATIC DATA: Types, Multi-gen Type Effectiveness, Natures,
 * Version Groups, Special Evolution Notes, Ability Tags
 *
 * Type chart eras supported:
 *   - 'modern'  Gen 6+ (default) — Bulbapedia verified
 *   - 'gen2-5'  Gen 2-5         — Removes Fairy + Steel resists Ghost/Dark
 *   - 'gen1'    Gen 1            — Best-effort approximation;
 *                                   TODO: verify every cell vs RBY reference
 * ============================================================ */

const CHART_ERA_LABEL = {
    modern: 'Modern (Gen 6+)',
    'gen2-5': 'Gen 2–5',
    gen1: 'Gen 1 (approximated)'
};

/* All 18 types, in the canonical display order */
const TYPES_MODERN = [
    'normal', 'fire', 'water', 'grass', 'electric', 'ice',
    'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug',
    'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'
];
const TYPES_GEN2_5 = TYPES_MODERN.filter(t => t !== 'fairy');
const TYPES_GEN1   = TYPES_GEN2_5.filter(t => t !== 'steel' && t !== 'dark');

const TYPE_NAMES_TH = {
    normal: 'ปกติ', fire: 'ไฟ', water: 'น้ำ', grass: 'พืช',
    electric: 'ไฟฟ้า', ice: 'น้ำแข็ง', fighting: 'ต่อสู้', poison: 'พิษ',
    ground: 'ดิน', flying: 'บิน', psychic: 'พลังจิต', bug: 'แมลง',
    rock: 'หิน', ghost: 'ผี', dragon: 'มังกร', dark: 'มืด',
    steel: 'เหล็ก', fairy: 'แฟรี่'
};

/* ----- MODERN (Gen 6+) — verified vs Bulbapedia ----- */
const TYPE_CHART_MODERN = {
    normal:   { rock: 0.5, ghost: 0, steel: 0.5 },
    fire:     { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
    water:    { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
    grass:    { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
    electric: { water: 2, grass: 0.5, electric: 0.5, ground: 0, flying: 2, dragon: 0.5 },
    ice:      { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
    fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
    poison:   { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
    ground:   { fire: 2, grass: 0.5, electric: 2, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
    flying:   { grass: 2, electric: 0.5, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
    psychic:  { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
    bug:      { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
    rock:     { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
    ghost:    { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
    dragon:   { dragon: 2, steel: 0.5, fairy: 0 },
    dark:     { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
    steel:    { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
    fairy:    { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 }
};

/* ----- GEN 2-5 — Modern minus Fairy, plus Steel resists Ghost/Dark ----- */
/* Differences from modern:
 *   - No Fairy type (any Fairy entry removed)
 *   - Ghost → Steel = 0.5   (Gen 6+ removed this resistance)
 *   - Dark  → Steel = 0.5   (Gen 6+ removed this resistance)
 */
function _buildGen2_5Chart() {
    const chart = {};
    for (const [atk, defs] of Object.entries(TYPE_CHART_MODERN)) {
        if (atk === 'fairy') continue;
        const filtered = {};
        for (const [def, mul] of Object.entries(defs)) {
            if (def === 'fairy') continue;
            filtered[def] = mul;
        }
        chart[atk] = filtered;
    }
    // Apply Steel resistance restorations
    chart.ghost = { ...chart.ghost, steel: 0.5 };
    chart.dark  = { ...chart.dark,  steel: 0.5 };
    return chart;
}
const TYPE_CHART_GEN2_5 = _buildGen2_5Chart();

/* ----- GEN 1 — best-effort approximation -----
 * Differences from Gen 2-5:
 *   - No Steel, no Dark, no Fairy types
 *   - Bug → Poison: 2× (became 0.5× in Gen 2)
 *   - Poison → Bug: 2× (became 1× in Gen 2)
 *   - Ghost → Psychic: 0× (famous Gen 1 bug; became 2× in Gen 2)
 *   - Ice → Fire: Fire takes 1× from Ice (became 0.5× in Gen 2)
 *
 * TODO: this list is the well-known set but Gen 1 has more
 * subtle differences (e.g., some critical hit interactions).
 * For exact per-cell comparison, see Bulbapedia "Type Chart (Gen I)".
 */
function _buildGen1Chart() {
    const chart = {};
    for (const [atk, defs] of Object.entries(TYPE_CHART_GEN2_5)) {
        if (atk === 'steel' || atk === 'dark') continue;
        const filtered = {};
        for (const [def, mul] of Object.entries(defs)) {
            if (def === 'steel' || def === 'dark') continue;
            filtered[def] = mul;
        }
        chart[atk] = filtered;
    }
    // Gen 1 specific overrides
    chart.bug = { ...chart.bug, poison: 2 };
    chart.poison = { ...chart.poison, bug: 2 };
    chart.ghost = { ...chart.ghost, psychic: 0 };
    // Ice → Fire: in Gen 1, Fire didn't resist Ice (1× instead of 0.5×)
    chart.ice = { ...chart.ice };
    delete chart.ice.fire;
    return chart;
}
const TYPE_CHART_GEN1 = _buildGen1Chart();

const TYPE_CHARTS = {
    modern: TYPE_CHART_MODERN,
    'gen2-5': TYPE_CHART_GEN2_5,
    gen1: TYPE_CHART_GEN1
};

const TYPES_BY_ERA = {
    modern: TYPES_MODERN,
    'gen2-5': TYPES_GEN2_5,
    gen1: TYPES_GEN1
};

/* ============================================================
 * Era-aware accessors
 *   - These delegate to whatever the active era is (set in version.js)
 *   - Default to 'modern' when no era selected
 * ============================================================ */

let _activeEra = 'modern';

function setActiveChartEra(era) {
    if (TYPE_CHARTS[era]) _activeEra = era;
}

function activeChartEra() { return _activeEra; }
function activeChart()    { return TYPE_CHARTS[_activeEra]; }
function activeTypes()    { return TYPES_BY_ERA[_activeEra]; }

/* Effectiveness of attacker type vs ONE defender type, in active era */
function getEffect(attacker, defender) {
    const chart = activeChart();
    const m = chart[attacker];
    if (!m) return 1;
    return defender in m ? m[defender] : 1;
}

/* Effectiveness of attacker vs combined defender types (1 or 2), in active era */
function getEffectMulti(attacker, defenders) {
    return defenders.reduce((mul, d) => mul * getEffect(attacker, d), 1);
}

/* True if any of the given types doesn't exist in the active era */
function defenderHasTypeOutsideEra(defenderTypes) {
    const valid = new Set(activeTypes());
    return defenderTypes.some(t => !valid.has(t));
}

/* ============================================================
 * Matchup analysis (shared by Quick Lookup, Type Calc, Detail)
 * ============================================================ */

function analyzeMatchups(defenderTypes) {
    const groups = { x4: [], x2: [], x1: [], half: [], quarter: [], zero: [] };
    for (const atk of activeTypes()) {
        const eff = getEffectMulti(atk, defenderTypes);
        if (eff === 4) groups.x4.push(atk);
        else if (eff === 2) groups.x2.push(atk);
        else if (eff === 1) groups.x1.push(atk);
        else if (eff === 0.5) groups.half.push(atk);
        else if (eff === 0.25) groups.quarter.push(atk);
        else if (eff === 0) groups.zero.push(atk);
    }
    return groups;
}

function bestAttacksAgainst(defenderTypes) {
    const out = [];
    for (const atk of activeTypes()) {
        const eff = getEffectMulti(atk, defenderTypes);
        if (eff >= 2) out.push({ type: atk, eff });
    }
    return out.sort((a, b) => b.eff - a.eff || a.type.localeCompare(b.type));
}

/* ============================================================
 * Natures (Static Verified)
 * ============================================================ */

const STAT_NAMES = {
    atk: 'การโจมตี', def: 'การป้องกัน', spa: 'โจมตีพิเศษ',
    spd: 'ป้องกันพิเศษ', spe: 'ความเร็ว'
};

const NATURES = [
    { name: 'Hardy',   up: null,  down: null  },
    { name: 'Lonely',  up: 'atk', down: 'def' },
    { name: 'Brave',   up: 'atk', down: 'spe' },
    { name: 'Adamant', up: 'atk', down: 'spa' },
    { name: 'Naughty', up: 'atk', down: 'spd' },
    { name: 'Bold',    up: 'def', down: 'atk' },
    { name: 'Docile',  up: null,  down: null  },
    { name: 'Relaxed', up: 'def', down: 'spe' },
    { name: 'Impish',  up: 'def', down: 'spa' },
    { name: 'Lax',     up: 'def', down: 'spd' },
    { name: 'Timid',   up: 'spe', down: 'atk' },
    { name: 'Hasty',   up: 'spe', down: 'def' },
    { name: 'Serious', up: null,  down: null  },
    { name: 'Jolly',   up: 'spe', down: 'spa' },
    { name: 'Naive',   up: 'spe', down: 'spd' },
    { name: 'Modest',  up: 'spa', down: 'atk' },
    { name: 'Mild',    up: 'spa', down: 'def' },
    { name: 'Quiet',   up: 'spa', down: 'spe' },
    { name: 'Bashful', up: null,  down: null  },
    { name: 'Rash',    up: 'spa', down: 'spd' },
    { name: 'Calm',    up: 'spd', down: 'atk' },
    { name: 'Gentle',  up: 'spd', down: 'def' },
    { name: 'Sassy',   up: 'spd', down: 'spe' },
    { name: 'Careful', up: 'spd', down: 'spa' },
    { name: 'Quirky',  up: null,  down: null  }
];

/* ============================================================
 * Version Groups
 *   chartEra → which type chart the actual game uses
 * ============================================================ */

const VERSION_GROUPS = [
    { id: 'scarlet-violet',                      label: 'Scarlet / Violet',           gen: 9, versions: ['scarlet', 'violet'],                          chartEra: 'modern' },
    { id: 'legends-arceus',                      label: 'Legends: Arceus',            gen: 8, versions: ['legends-arceus'],                             chartEra: 'modern' },
    { id: 'brilliant-diamond-and-shining-pearl', label: 'Brilliant Diamond / Shining Pearl', gen: 8, versions: ['brilliant-diamond', 'shining-pearl'], chartEra: 'modern' },
    { id: 'sword-shield',                        label: 'Sword / Shield',             gen: 8, versions: ['sword', 'shield'],                            chartEra: 'modern' },
    { id: 'lets-go-pikachu-lets-go-eevee',       label: "Let's Go Pikachu / Eevee",   gen: 7, versions: ['lets-go-pikachu', 'lets-go-eevee'],            chartEra: 'modern' },
    { id: 'ultra-sun-ultra-moon',                label: 'Ultra Sun / Ultra Moon',     gen: 7, versions: ['ultra-sun', 'ultra-moon'],                    chartEra: 'modern' },
    { id: 'sun-moon',                            label: 'Sun / Moon',                 gen: 7, versions: ['sun', 'moon'],                                chartEra: 'modern' },
    { id: 'omega-ruby-alpha-sapphire',           label: 'Omega Ruby / Alpha Sapphire', gen: 6, versions: ['omega-ruby', 'alpha-sapphire'],              chartEra: 'modern' },
    { id: 'x-y',                                 label: 'X / Y',                      gen: 6, versions: ['x', 'y'],                                    chartEra: 'modern' },
    { id: 'black-2-white-2',                     label: 'Black 2 / White 2',          gen: 5, versions: ['black-2', 'white-2'],                        chartEra: 'gen2-5' },
    { id: 'black-white',                         label: 'Black / White',              gen: 5, versions: ['black', 'white'],                            chartEra: 'gen2-5' },
    { id: 'heartgold-soulsilver',                label: 'HeartGold / SoulSilver',     gen: 4, versions: ['heartgold', 'soulsilver'],                    chartEra: 'gen2-5' },
    { id: 'platinum',                            label: 'Platinum',                   gen: 4, versions: ['platinum'],                                   chartEra: 'gen2-5' },
    { id: 'diamond-pearl',                       label: 'Diamond / Pearl',            gen: 4, versions: ['diamond', 'pearl'],                          chartEra: 'gen2-5' },
    { id: 'firered-leafgreen',                   label: 'FireRed / LeafGreen',        gen: 3, versions: ['firered', 'leafgreen'],                      chartEra: 'gen2-5' },
    { id: 'emerald',                             label: 'Emerald',                    gen: 3, versions: ['emerald'],                                   chartEra: 'gen2-5' },
    { id: 'ruby-sapphire',                       label: 'Ruby / Sapphire',            gen: 3, versions: ['ruby', 'sapphire'],                          chartEra: 'gen2-5' },
    { id: 'crystal',                             label: 'Crystal',                    gen: 2, versions: ['crystal'],                                   chartEra: 'gen2-5' },
    { id: 'gold-silver',                         label: 'Gold / Silver',              gen: 2, versions: ['gold', 'silver'],                            chartEra: 'gen2-5' },
    { id: 'yellow',                              label: 'Yellow',                     gen: 1, versions: ['yellow'],                                    chartEra: 'gen1' },
    { id: 'red-blue',                            label: 'Red / Blue',                 gen: 1, versions: ['red', 'blue'],                                chartEra: 'gen1' }
];

const DEFAULT_VERSION_GROUP = 'scarlet-violet';

function getVersionGroup(id) {
    return VERSION_GROUPS.find(v => v.id === id) || VERSION_GROUPS[0];
}

/* National Pokédex caps per generation — used to scope Pokémon
 * suggestions so we don't recommend a Gen 9 Pokémon when the user
 * is playing Gen 3. These match the last Pokémon introduced in
 * each generation (Mew=151, Celebi=251, …, Pecharunt=1025). */
const GEN_DEX_CAP = {
    1: 151,
    2: 251,
    3: 386,
    4: 493,
    5: 649,
    6: 721,
    7: 809,
    8: 905,
    9: 1025
};

/* Curated "common picks" per defensive type. Used as one of the three
 * sub-pools when building the suggestion candidate pool. These names
 * must match the PokéAPI /pokemon/{name} endpoint (default forms only,
 * no variants — variant suggestions are out of scope for this round).
 *
 * Curated entries still get gen-cap filtered, so older generations
 * will naturally drop newer picks. */
const CURATED_PATCH_CANDIDATES = {
    normal:   ['blissey', 'snorlax', 'kangaskhan', 'staraptor', 'porygon-z'],
    fire:     ['heatran', 'volcarona', 'cinderace', 'incineroar', 'chandelure', 'arcanine'],
    water:    ['gyarados', 'milotic', 'gastrodon', 'toxapex', 'dondozo', 'swampert', 'azumarill'],
    electric: ['magnezone', 'jolteon', 'raikou', 'zapdos', 'iron-hands', 'pikachu'],
    grass:    ['ferrothorn', 'amoonguss', 'breloom', 'rillaboom', 'tangrowth', 'venusaur', 'meowscarada'],
    ice:      ['kyurem', 'baxcalibur', 'mamoswine', 'avalugg', 'froslass', 'lapras'],
    fighting: ['lucario', 'breloom', 'great-tusk', 'iron-hands', 'machamp', 'conkeldurr', 'urshifu'],
    poison:   ['toxapex', 'amoonguss', 'gengar', 'crobat', 'glimmora'],
    ground:   ['garchomp', 'excadrill', 'gliscor', 'hippowdon', 'clodsire', 'great-tusk', 'iron-treads', 'swampert', 'rhyperior'],
    flying:   ['skarmory', 'gliscor', 'corviknight', 'talonflame', 'dragonite', 'salamence', 'zapdos', 'staraptor'],
    psychic:  ['gardevoir', 'metagross', 'cresselia', 'slowking', 'flutter-mane', 'tapu-lele', 'espeon'],
    bug:      ['scizor', 'volcarona', 'ribombee', 'galvantula', 'iron-moth', 'heracross'],
    rock:     ['tyranitar', 'aerodactyl', 'rhyperior', 'garganacl', 'kleavor', 'aurorus'],
    ghost:    ['gengar', 'aegislash', 'mimikyu', 'dragapult', 'sableye', 'gholdengo', 'flutter-mane'],
    dragon:   ['dragonite', 'salamence', 'garchomp', 'hydreigon', 'dragapult', 'archaludon', 'roaring-moon', 'baxcalibur'],
    dark:     ['tyranitar', 'hydreigon', 'kingambit', 'darkrai', 'umbreon', 'meowscarada', 'weavile'],
    steel:    ['skarmory', 'scizor', 'steelix', 'metagross', 'magnezone', 'lucario', 'excadrill', 'corviknight', 'tinkaton', 'kingambit', 'ferrothorn', 'gholdengo', 'aegislash'],
    fairy:    ['clefable', 'sylveon', 'azumarill', 'mimikyu', 'grimmsnarl', 'tinkaton', 'flutter-mane', 'gardevoir', 'iron-valiant']
};

/* ============================================================
 * Stat mapping
 * ============================================================ */
const STAT_KEY_MAP = {
    'hp': 'hp', 'attack': 'atk', 'defense': 'def',
    'special-attack': 'spa', 'special-defense': 'spd', 'speed': 'spe'
};
const STAT_LABELS = {
    hp: 'HP', atk: 'Attack', def: 'Defense',
    spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed'
};

/* ============================================================
 * Form name formatting
 * ============================================================ */

/* Special-cased pretty names that the generic formatter can't get right
 *   (apostrophes, colons, accents, capitalization quirks). */
const SPECIAL_NAMES = {
    // Apostrophes
    'farfetchd':         "Farfetch'd",
    'farfetchd-galar':   "Galarian Farfetch'd",
    'sirfetchd':         "Sirfetch'd",
    // Dots
    'mr-mime':           'Mr. Mime',
    'mr-mime-galar':     'Galarian Mr. Mime',
    'mr-rime':           'Mr. Rime',
    'mime-jr':           'Mime Jr.',
    // Colons
    'type-null':         'Type: Null',
    // Hyphens that need preserving as hyphens
    'ho-oh':             'Ho-Oh',
    'porygon-z':         'Porygon-Z',
    'porygon2':          'Porygon2',
    'jangmo-o':          'Jangmo-o',
    'hakamo-o':          'Hakamo-o',
    'kommo-o':           'Kommo-o',
    // Tapu (no hyphen in display)
    'tapu-koko':         'Tapu Koko',
    'tapu-lele':         'Tapu Lele',
    'tapu-bulu':         'Tapu Bulu',
    'tapu-fini':         'Tapu Fini',
    // Other
    'nidoran-f':         'Nidoran♀',
    'nidoran-m':         'Nidoran♂',
    'flabebe':           'Flabébé',
    // Ultra Beasts (codename forms)
    'wo-chien':          'Wo-Chien',
    'chien-pao':         'Chien-Pao',
    'ting-lu':           'Ting-Lu',
    'chi-yu':            'Chi-Yu'
};

/* Pretty display name for a Pokémon header/title.
 *   - Default form → "Charizard"
 *   - Variant      → "Alolan Vulpix", "Mega Charizard X", "Rotom (Wash)", etc.
 *   - Special name → "Mr. Mime", "Farfetch'd", "Type: Null"
 *
 * (formatFormName below is the variant-suffix formatter used by the form
 *  dropdown — it returns the literal "Default" for the base form.) */
function prettyPokemonName(variantName, baseName) {
    if (!variantName) return capitalize(baseName || '');

    // Direct special-case override
    if (SPECIAL_NAMES[variantName]) return SPECIAL_NAMES[variantName];

    // Base form (variantName === baseName) — use special if base is special
    if (!baseName || variantName === baseName) {
        return SPECIAL_NAMES[baseName] || capitalize(variantName);
    }

    // Variant — let formatFormName do regional/mega formatting
    const f = formatFormName(variantName, baseName);
    if (f === 'Default') return SPECIAL_NAMES[baseName] || capitalize(baseName);

    // Patch baseName inside the formatted string with the pretty special name
    if (SPECIAL_NAMES[baseName]) {
        const cap = capitalize(baseName);
        return f.replace(cap, SPECIAL_NAMES[baseName]);
    }
    return f;
}

function formatFormName(variantName, baseName) {
    if (!variantName) return capitalize(baseName || '');
    if (variantName === baseName) return 'Default';

    const suffix = variantName.startsWith(baseName + '-')
        ? variantName.slice(baseName.length + 1)
        : variantName;

    const regionalMap = { alola: 'Alolan', galar: 'Galarian', hisui: 'Hisuian', paldea: 'Paldean' };
    // Mega suffix → put suffix AFTER the base name ("Mega Charizard X" not "Mega X Charizard")
    const megaPrefixMap = { 'mega': 'Mega', primal: 'Primal', gmax: 'Gigantamax', eternamax: 'Eternamax' };
    const megaSuffixMap = { 'mega-x': { prefix: 'Mega', suffix: 'X' }, 'mega-y': { prefix: 'Mega', suffix: 'Y' } };
    const formMap = {
        'origin': 'Origin Forme', 'altered': 'Altered Forme',
        'sky': 'Sky Forme', 'land': 'Land Forme',
        'therian': 'Therian Forme', 'incarnate': 'Incarnate Forme',
        'heat': 'Heat', 'wash': 'Wash', 'frost': 'Frost', 'fan': 'Fan', 'mow': 'Mow',
        'attack': 'Attack Forme', 'defense': 'Defense Forme', 'speed': 'Speed Forme',
        'plant': 'Plant Cloak', 'sandy': 'Sandy Cloak', 'trash': 'Trash Cloak',
        'east': 'East Sea', 'west': 'West Sea',
        'sunshine': 'Sunshine Form', 'overcast': 'Overcast Form',
        'paldea-combat-breed': 'Paldean Combat Breed',
        'paldea-blaze-breed': 'Paldean Blaze Breed',
        'paldea-aqua-breed': 'Paldean Aqua Breed',
        'white-striped': 'White-Striped',
        'red-striped': 'Red-Striped',
        'blue-striped': 'Blue-Striped',
        'midday': 'Midday Form', 'midnight': 'Midnight Form', 'dusk': 'Dusk Form',
        'dawn': 'Dawn Wings', 'dusk-mane': 'Dusk Mane',
        'low-key': 'Low Key', 'amped': 'Amped',
        'roaming': 'Roaming Form', 'chest': 'Chest Form'
    };

    if (regionalMap[suffix]) return `${regionalMap[suffix]} ${capitalize(baseName)}`;
    if (megaPrefixMap[suffix]) return `${megaPrefixMap[suffix]} ${capitalize(baseName)}`;
    if (megaSuffixMap[suffix]) {
        const m = megaSuffixMap[suffix];
        return `${m.prefix} ${capitalize(baseName)} ${m.suffix}`;
    }
    // Rotom appliance forms use prefix style: "Wash Rotom" not "Rotom (Wash)"
    if (baseName === 'rotom') {
        const rotomPrefix = { heat: 'Heat', wash: 'Wash', frost: 'Frost', fan: 'Fan', mow: 'Mow' };
        if (rotomPrefix[suffix]) return `${rotomPrefix[suffix]} ${capitalize(baseName)}`;
    }
    if (formMap[suffix])     return `${capitalize(baseName)} (${formMap[suffix]})`;

    return capitalize(variantName.replace(/-/g, ' '));
}

/* ============================================================
 * Form aliases — let users search by human-friendly form names
 *
 *   alias  = what the user might type ("alolan vulpix")
 *   target = PokéAPI /pokemon endpoint name ("vulpix-alola")
 *   display = pretty label for autocomplete suggestion
 *   baseId = species Pokédex number (used for sort/dex display)
 * ============================================================ */

const FORM_ALIASES = [
    // Alolan
    { alias: 'alolan vulpix',     target: 'vulpix-alola',     display: 'Alolan Vulpix',     baseId: 37 },
    { alias: 'alolan ninetales',  target: 'ninetales-alola',  display: 'Alolan Ninetales',  baseId: 38 },
    { alias: 'alolan meowth',     target: 'meowth-alola',     display: 'Alolan Meowth',     baseId: 52 },
    { alias: 'alolan persian',    target: 'persian-alola',    display: 'Alolan Persian',    baseId: 53 },
    { alias: 'alolan rattata',    target: 'rattata-alola',    display: 'Alolan Rattata',    baseId: 19 },
    { alias: 'alolan raticate',   target: 'raticate-alola',   display: 'Alolan Raticate',   baseId: 20 },
    { alias: 'alolan raichu',     target: 'raichu-alola',     display: 'Alolan Raichu',     baseId: 26 },
    { alias: 'alolan sandshrew',  target: 'sandshrew-alola',  display: 'Alolan Sandshrew',  baseId: 27 },
    { alias: 'alolan sandslash',  target: 'sandslash-alola',  display: 'Alolan Sandslash',  baseId: 28 },
    { alias: 'alolan diglett',    target: 'diglett-alola',    display: 'Alolan Diglett',    baseId: 50 },
    { alias: 'alolan dugtrio',    target: 'dugtrio-alola',    display: 'Alolan Dugtrio',    baseId: 51 },
    { alias: 'alolan geodude',    target: 'geodude-alola',    display: 'Alolan Geodude',    baseId: 74 },
    { alias: 'alolan graveler',   target: 'graveler-alola',   display: 'Alolan Graveler',   baseId: 75 },
    { alias: 'alolan golem',      target: 'golem-alola',      display: 'Alolan Golem',      baseId: 76 },
    { alias: 'alolan grimer',     target: 'grimer-alola',     display: 'Alolan Grimer',     baseId: 88 },
    { alias: 'alolan muk',        target: 'muk-alola',        display: 'Alolan Muk',        baseId: 89 },
    { alias: 'alolan exeggutor',  target: 'exeggutor-alola',  display: 'Alolan Exeggutor',  baseId: 103 },
    { alias: 'alolan marowak',    target: 'marowak-alola',    display: 'Alolan Marowak',    baseId: 105 },

    // Galarian
    { alias: 'galarian meowth',   target: 'meowth-galar',   display: 'Galarian Meowth',   baseId: 52 },
    { alias: 'galarian ponyta',   target: 'ponyta-galar',   display: 'Galarian Ponyta',   baseId: 77 },
    { alias: 'galarian rapidash', target: 'rapidash-galar', display: 'Galarian Rapidash', baseId: 78 },
    { alias: 'galarian slowpoke', target: 'slowpoke-galar', display: 'Galarian Slowpoke', baseId: 79 },
    { alias: 'galarian slowbro',  target: 'slowbro-galar',  display: 'Galarian Slowbro',  baseId: 80 },
    { alias: 'galarian slowking', target: 'slowking-galar', display: 'Galarian Slowking', baseId: 199 },
    { alias: 'galarian farfetchd', target: 'farfetchd-galar', display: "Galarian Farfetch'd", baseId: 83 },
    { alias: 'galarian weezing',  target: 'weezing-galar',  display: 'Galarian Weezing',  baseId: 110 },
    { alias: 'galarian mr mime',  target: 'mr-mime-galar',  display: 'Galarian Mr. Mime', baseId: 122 },
    { alias: 'galarian articuno', target: 'articuno-galar', display: 'Galarian Articuno', baseId: 144 },
    { alias: 'galarian zapdos',   target: 'zapdos-galar',   display: 'Galarian Zapdos',   baseId: 145 },
    { alias: 'galarian moltres',  target: 'moltres-galar',  display: 'Galarian Moltres',  baseId: 146 },
    { alias: 'galarian corsola',  target: 'corsola-galar',  display: 'Galarian Corsola',  baseId: 222 },
    { alias: 'galarian zigzagoon', target: 'zigzagoon-galar', display: 'Galarian Zigzagoon', baseId: 263 },
    { alias: 'galarian linoone', target: 'linoone-galar',  display: 'Galarian Linoone',  baseId: 264 },
    { alias: 'galarian darumaka', target: 'darumaka-galar', display: 'Galarian Darumaka', baseId: 554 },
    { alias: 'galarian darmanitan', target: 'darmanitan-galar-standard', display: 'Galarian Darmanitan', baseId: 555 },
    { alias: 'galarian yamask',   target: 'yamask-galar',   display: 'Galarian Yamask',   baseId: 562 },
    { alias: 'galarian stunfisk', target: 'stunfisk-galar', display: 'Galarian Stunfisk', baseId: 618 },

    // Hisuian
    { alias: 'hisuian growlithe', target: 'growlithe-hisui', display: 'Hisuian Growlithe', baseId: 58 },
    { alias: 'hisuian arcanine',  target: 'arcanine-hisui',  display: 'Hisuian Arcanine',  baseId: 59 },
    { alias: 'hisuian voltorb',   target: 'voltorb-hisui',   display: 'Hisuian Voltorb',   baseId: 100 },
    { alias: 'hisuian electrode', target: 'electrode-hisui', display: 'Hisuian Electrode', baseId: 101 },
    { alias: 'hisuian typhlosion', target: 'typhlosion-hisui', display: 'Hisuian Typhlosion', baseId: 157 },
    { alias: 'hisuian qwilfish', target: 'qwilfish-hisui',  display: 'Hisuian Qwilfish',  baseId: 211 },
    { alias: 'hisuian sneasel',  target: 'sneasel-hisui',   display: 'Hisuian Sneasel',   baseId: 215 },
    { alias: 'hisuian samurott', target: 'samurott-hisui',  display: 'Hisuian Samurott',  baseId: 503 },
    { alias: 'hisuian lilligant', target: 'lilligant-hisui', display: 'Hisuian Lilligant', baseId: 549 },
    { alias: 'hisuian basculin', target: 'basculin-white-striped', display: 'Hisuian Basculin (White-Striped)', baseId: 550 },
    { alias: 'hisuian zorua',    target: 'zorua-hisui',     display: 'Hisuian Zorua',     baseId: 570 },
    { alias: 'hisuian zoroark',  target: 'zoroark-hisui',   display: 'Hisuian Zoroark',   baseId: 571 },
    { alias: 'hisuian braviary', target: 'braviary-hisui',  display: 'Hisuian Braviary',  baseId: 628 },
    { alias: 'hisuian sliggoo',  target: 'sliggoo-hisui',   display: 'Hisuian Sliggoo',   baseId: 705 },
    { alias: 'hisuian goodra',   target: 'goodra-hisui',    display: 'Hisuian Goodra',    baseId: 706 },
    { alias: 'hisuian avalugg',  target: 'avalugg-hisui',   display: 'Hisuian Avalugg',   baseId: 713 },
    { alias: 'hisuian decidueye', target: 'decidueye-hisui', display: 'Hisuian Decidueye', baseId: 724 },

    // Paldean
    { alias: 'paldean tauros',         target: 'tauros-paldea-combat-breed', display: 'Paldean Tauros (Combat)', baseId: 128 },
    { alias: 'paldean tauros combat',  target: 'tauros-paldea-combat-breed', display: 'Paldean Tauros (Combat)', baseId: 128 },
    { alias: 'paldean tauros blaze',   target: 'tauros-paldea-blaze-breed',  display: 'Paldean Tauros (Blaze)',  baseId: 128 },
    { alias: 'paldean tauros aqua',    target: 'tauros-paldea-aqua-breed',   display: 'Paldean Tauros (Aqua)',   baseId: 128 },
    { alias: 'paldean wooper',         target: 'wooper-paldea',              display: 'Paldean Wooper',          baseId: 194 },

    // Mega
    { alias: 'mega charizard x', target: 'charizard-mega-x', display: 'Mega Charizard X', baseId: 6 },
    { alias: 'mega charizard y', target: 'charizard-mega-y', display: 'Mega Charizard Y', baseId: 6 },
    { alias: 'mega charizard',   target: 'charizard-mega-x', display: 'Mega Charizard X (default)', baseId: 6 },
    { alias: 'mega mewtwo x',    target: 'mewtwo-mega-x', display: 'Mega Mewtwo X', baseId: 150 },
    { alias: 'mega mewtwo y',    target: 'mewtwo-mega-y', display: 'Mega Mewtwo Y', baseId: 150 },
    { alias: 'mega blastoise',   target: 'blastoise-mega', display: 'Mega Blastoise', baseId: 9 },
    { alias: 'mega venusaur',    target: 'venusaur-mega',  display: 'Mega Venusaur',  baseId: 3 },
    { alias: 'mega gengar',      target: 'gengar-mega',    display: 'Mega Gengar',    baseId: 94 },
    { alias: 'mega gyarados',    target: 'gyarados-mega',  display: 'Mega Gyarados',  baseId: 130 },
    { alias: 'mega lucario',     target: 'lucario-mega',   display: 'Mega Lucario',   baseId: 448 },
    { alias: 'mega garchomp',    target: 'garchomp-mega',  display: 'Mega Garchomp',  baseId: 445 },
    { alias: 'mega rayquaza',    target: 'rayquaza-mega',  display: 'Mega Rayquaza',  baseId: 384 },
    { alias: 'primal groudon',   target: 'groudon-primal', display: 'Primal Groudon', baseId: 383 },
    { alias: 'primal kyogre',    target: 'kyogre-primal',  display: 'Primal Kyogre',  baseId: 382 },

    // Rotom appliances
    { alias: 'heat rotom',  target: 'rotom-heat',  display: 'Heat Rotom',  baseId: 479 },
    { alias: 'wash rotom',  target: 'rotom-wash',  display: 'Wash Rotom',  baseId: 479 },
    { alias: 'frost rotom', target: 'rotom-frost', display: 'Frost Rotom', baseId: 479 },
    { alias: 'fan rotom',   target: 'rotom-fan',   display: 'Fan Rotom',   baseId: 479 },
    { alias: 'mow rotom',   target: 'rotom-mow',   display: 'Mow Rotom',   baseId: 479 },

    // Others
    { alias: 'origin giratina', target: 'giratina-origin', display: 'Origin Giratina', baseId: 487 },
    { alias: 'sky shaymin',     target: 'shaymin-sky',     display: 'Sky Shaymin',     baseId: 492 },
    { alias: 'therian tornadus', target: 'tornadus-therian', display: 'Therian Tornadus', baseId: 641 },
    { alias: 'therian thundurus', target: 'thundurus-therian', display: 'Therian Thundurus', baseId: 642 },
    { alias: 'therian landorus', target: 'landorus-therian', display: 'Therian Landorus', baseId: 645 },
    { alias: 'black kyurem',    target: 'kyurem-black',    display: 'Black Kyurem',    baseId: 646 },
    { alias: 'white kyurem',    target: 'kyurem-white',    display: 'White Kyurem',    baseId: 646 },
    { alias: 'dawn wings necrozma', target: 'necrozma-dawn', display: 'Dawn Wings Necrozma', baseId: 800 },
    { alias: 'dusk mane necrozma', target: 'necrozma-dusk',  display: 'Dusk Mane Necrozma', baseId: 800 },
    { alias: 'ultra necrozma',  target: 'necrozma-ultra',  display: 'Ultra Necrozma',  baseId: 800 },

    // Gigantamax
    { alias: 'gmax charizard',  target: 'charizard-gmax',  display: 'Gigantamax Charizard',  baseId: 6 },
    { alias: 'gmax pikachu',    target: 'pikachu-gmax',    display: 'Gigantamax Pikachu',    baseId: 25 },
    { alias: 'gmax meowth',     target: 'meowth-gmax',     display: 'Gigantamax Meowth',     baseId: 52 },
    { alias: 'gmax eevee',      target: 'eevee-gmax',      display: 'Gigantamax Eevee',      baseId: 133 },
    { alias: 'gmax snorlax',    target: 'snorlax-gmax',    display: 'Gigantamax Snorlax',    baseId: 143 },
    { alias: 'gmax lapras',     target: 'lapras-gmax',     display: 'Gigantamax Lapras',     baseId: 131 }
];

/* ============================================================
 * Special evolution notes (PokéAPI returns incomplete data)
 *   Key: source species PokéAPI name (use API name with dashes)
 *   Value: { condition: human-readable string, gen: when introduced (optional) }
 * ============================================================ */

const SPECIAL_EVO_NOTES = {
    'wurmple':           { note: 'แตกสาย Silcoon (→Beautifly) หรือ Cascoon (→Dustox) ตามค่า personality value แบบสุ่มตอนเกิด' },
    'tyrogue':           { note: 'Lv 20: Atk>Def → Hitmonlee, Atk<Def → Hitmonchan, Atk=Def → Hitmontop' },
    'inkay':             { note: 'Lv 30 + คว่ำเครื่อง (3DS) / กดปุ่ม R+L (Switch)' },
    'pancham':           { note: 'Lv 32 + มีโปเกม่อนธาตุ Dark ในทีม' },
    'farfetchd-galar':   { note: 'Sirfetch\'d: ขณะเป็น Galarian Farfetch\'d ทำ critical hit 3 ครั้งในการต่อสู้ครั้งเดียว' },
    'basculin-white-striped': { note: 'Basculegion: รับ recoil damage ≥ 294 HP สะสมแล้ว level up' },
    'primeape':          { note: 'Annihilape: ใช้ท่า Rage Fist ครบ 20 ครั้ง แล้ว level up' },
    'bisharp':           { note: 'Kingambit: ถือ Leader\'s Crest + ชนะ Bisharp 3 ตัวที่ถือ Leader\'s Crest แล้ว level up' },
    'gimmighoul':        { note: 'Gholdengo: มี Gimmighoul Coin 999 เหรียญ แล้ว level up' },
    'milcery':           { note: 'Alcremie: spin + pose ขณะถือ Sweet — รูปร่างขึ้นกับทิศทาง spin และเวลา' },
    'mantyke':           { note: 'Mantine: Level up ขณะมี Remoraid ในทีม' },
    'pawmo':             { note: 'Pawmot: ออกเดิน 1000 ก้าวกับ Pawmo ที่ปล่อยจาก Poké Ball (Let\'s Go feature)' },
    'rellor':            { note: 'Rabsca: ออกเดิน 1000 ก้าวกับ Rellor ที่ปล่อยจาก Poké Ball' },
    'finizen':           { note: 'Palafin: Lv 38 ขณะเชื่อมต่อ Union Circle กับผู้เล่นอื่น (multiplayer)' },
    'bramblin':          { note: 'Brambleghast: ออกเดิน 1000 ก้าวกับ Bramblin ที่ปล่อยจาก Poké Ball' },
    'charcadet':         { note: 'Armarouge: ใช้ Auspicious Armor (Scarlet) / Ceruledge: ใช้ Malicious Armor (Violet)' },
    'rockruff':          { note: 'Lycanroc: Midday (กลางวัน), Midnight (กลางคืน), Dusk Form (พลบค่ำ 17:00-17:59 ในเกม + ability Own Tempo)' },
    'feebas':            { note: 'Milotic: เลเวลอัพขณะ Beauty สูงสุด (Gen 3-4) หรือ Trade ขณะถือ Prism Scale (Gen 5+)' },
    'sliggoo':           { note: 'Goodra / Hisuian Goodra: Lv 50 ขณะฝนตกในโลก (หรือหมอกใน Legends: Arceus)' },
    'eevee':             { note: '8 สาย: Vaporeon/Jolteon/Flareon (stones), Espeon/Umbreon (happiness + เวลา), Leafeon/Glaceon (location หรือ Leaf/Ice Stone ใน Gen 8+), Sylveon (high friendship + รู้ Fairy move)' },
    'kubfu':             { note: 'Urshifu: เคลียร์หอ Tower of Darkness (Single Strike) หรือ Tower of Waters (Rapid Strike)' },
    'galarian-yamask':   { note: 'Runerigus: ขณะ HP เหลือ <50% เดินผ่าน Dusty Bowl + แตะหินขนาดใหญ่' },
    'cosmoem':           { note: 'Lv 53: Solgaleo (Sun/USum) / Lunala (Moon/UMoon) — ภาคต่างกัน' },
    'mime-jr':           { note: 'Mr. Mime: Level up ขณะรู้ท่า Mimic (Galarian Mr. Mime ในเกม Gen 8+)' },
    'magneton':          { note: 'Magnezone: Level up ใน Magnetic Field area (Mt. Coronet etc.) หรือใช้ Thunder Stone (Gen 8+)' },
    'nosepass':          { note: 'Probopass: Level up ใน Magnetic Field area หรือใช้ Thunder Stone (Gen 8+)' }
};

/* ============================================================
 * Location data overrides (manual verified entries)
 *
 * Source priority:
 *   1. Manual override (this map)
 *   2. PokéAPI encounters
 *   3. No data
 *
 * Currently empty — placeholder for future manual additions.
 * Add entries like:
 *   LOCATION_OVERRIDES['pikachu:red-blue'] = {
 *     verifiedBy: 'Bulbapedia 2024-XX-XX',
 *     locations: ['Viridian Forest', 'Power Plant']
 *   };
 * ============================================================ */

const LOCATION_OVERRIDES = {};

function getLocationOverride(pokemonName, versionGroupId) {
    return LOCATION_OVERRIDES[`${pokemonName}:${versionGroupId}`] || null;
}

/* ============================================================
 * Ability tags (curated)
 *
 * PokéAPI doesn't categorize abilities — this is a hand-built
 * tag map for the most-played abilities. Missing entries fall
 * back to "Other".
 * ============================================================ */

const ABILITY_TAGS = {
    // Weather setters
    'drizzle': ['weather'], 'drought': ['weather'], 'sand-stream': ['weather'],
    'snow-warning': ['weather'], 'desolate-land': ['weather'], 'primordial-sea': ['weather'],
    'delta-stream': ['weather'], 'orichalcum-pulse': ['weather'],

    // Terrain
    'electric-surge': ['terrain'], 'grassy-surge': ['terrain'],
    'misty-surge': ['terrain'], 'psychic-surge': ['terrain'],
    'hadron-engine': ['terrain'],

    // Status (contact / inflicts status on opponent)
    'static': ['status', 'contact'], 'flame-body': ['status', 'contact'],
    'poison-point': ['status', 'contact'], 'effect-spore': ['status', 'contact'],
    'cute-charm': ['status', 'contact'], 'stench': ['status'],
    'gooey': ['stat', 'contact'], 'tangling-hair': ['stat', 'contact'],
    'mummy': ['status', 'contact'], 'lingering-aroma': ['status', 'contact'],
    'wandering-spirit': ['status', 'contact'],

    // Damage boosters
    'adaptability': ['damage'], 'tinted-lens': ['damage'], 'sniper': ['damage'],
    'sheer-force': ['damage'], 'iron-fist': ['damage'], 'mega-launcher': ['damage'],
    'tough-claws': ['damage', 'contact'], 'strong-jaw': ['damage'],
    'reckless': ['damage'], 'analytic': ['damage'], 'technician': ['damage'],
    'aerilate': ['damage'], 'pixilate': ['damage'], 'refrigerate': ['damage'],
    'galvanize': ['damage'], 'normalize': ['damage'],
    'huge-power': ['damage', 'stat'], 'pure-power': ['damage', 'stat'],
    'guts': ['damage', 'stat'], 'flare-boost': ['damage', 'stat'],
    'toxic-boost': ['damage', 'stat'],
    'protean': ['damage'], 'libero': ['damage'],

    // Stat changes
    'intimidate': ['stat'], 'download': ['stat'], 'speed-boost': ['stat'],
    'moxie': ['stat'], 'beast-boost': ['stat'], 'soul-heart': ['stat'],
    'grim-neigh': ['stat'], 'as-one': ['stat'], 'chilling-neigh': ['stat'],
    'competitive': ['stat'], 'defiant': ['stat'],
    'sand-rush': ['stat'], 'swift-swim': ['stat'], 'chlorophyll': ['stat'],
    'slush-rush': ['stat'], 'sand-veil': ['stat'], 'snow-cloak': ['stat'],
    'unburden': ['stat', 'item'], 'flash-fire': ['stat'],
    'motor-drive': ['stat'], 'lightning-rod': ['stat'], 'storm-drain': ['stat'],
    'sap-sipper': ['stat'], 'volt-absorb': ['stat'], 'water-absorb': ['stat'],

    // Switching / pivot
    'regenerator': ['switching'], 'natural-cure': ['switching'],
    'shed-skin': ['switching'], 'magic-bounce': ['switching'],
    'magic-guard': ['damage'], 'wonder-guard': ['damage'],

    // Items
    'pickpocket': ['item', 'contact'], 'magician': ['item'],
    'pickup': ['item'], 'harvest': ['item'], 'cheek-pouch': ['item'],
    'ripen': ['item'],

    // Defensive
    'levitate': ['damage'], 'thick-fat': ['damage'], 'fluffy': ['damage', 'contact'],
    'filter': ['damage'], 'solid-rock': ['damage'], 'prism-armor': ['damage'],
    'multiscale': ['damage'], 'shadow-shield': ['damage'],
    'ice-scales': ['damage'], 'fur-coat': ['damage'],

    // Niche
    'trace': ['stat'], 'imposter': ['stat'],
    'protean': ['damage'], 'color-change': ['damage'],
    'truant': ['status'], 'slow-start': ['stat'],
    'mold-breaker': ['damage'], 'teravolt': ['damage'], 'turboblaze': ['damage'],
    'pressure': ['status'],
};

const ABILITY_CATEGORY_LABELS = {
    weather: '☀️ Weather',
    terrain: '🌐 Terrain',
    damage: '⚔️ Damage',
    stat: '📊 Stat',
    status: '💫 Status',
    contact: '🤝 Contact',
    switching: '🔄 Switching',
    item: '🎒 Item'
};

/* ============================================================
 * Helpers
 * ============================================================ */
function capitalize(s) {
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ');
}

function statColorClass(val) {
    if (val >= 110) return 'high';
    if (val >= 75) return 'mid';
    if (val >= 50) return '';
    return 'low';
}

function extractIdFromUrl(url) {
    if (!url) return null;
    const m = url.match(/\/(\d+)\/?$/);
    return m ? m[1] : null;
}

/* Compatibility: keep TYPES exported for chart.js etc. that iterate display order */
const TYPES = TYPES_MODERN;

/* App version — bump when shipping a new release.
 * Mirrored in sw.js APP_SHELL_VERSION when files change. */
const APP_VERSION = '1.7.2';
const APP_BUILD_DATE = '2026-05-28';
