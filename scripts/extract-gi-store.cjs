/**
 * Extracts character & weapon data from the Enka LodaHoyoView JS bundle
 * and saves a JSON supplement used by the scraper for new characters not yet in GitHub store.
 */
const fs = require('fs');
const path = require('path');

const inputFile = process.argv[2] || path.join(__dirname, '../LodaHoyoView.svelte_svelte_type_style_lang.2148046f.js');
const outputFile = path.join(__dirname, '../temp/gi-store-supplement.json');

if (!fs.existsSync(inputFile)) {
    console.error('Input file not found:', inputFile);
    process.exit(1);
}

const content = fs.readFileSync(inputFile, 'utf8');
console.log('File size:', content.length, 'bytes');

/**
 * Extract a balanced JS object starting at `{` from position `start`.
 * Returns the substring including braces, or null if not found.
 */
function extractObject(str, start) {
    let depth = 0;
    let i = start;
    let inString = false;
    let stringChar = '';
    while (i < str.length) {
        const ch = str[i];
        if (inString) {
            if (ch === '\\') { i += 2; continue; }
            if (ch === stringChar) inString = false;
        } else {
            if (ch === '"' || ch === "'") { inString = true; stringChar = ch; }
            else if (ch === '{') depth++;
            else if (ch === '}') { depth--; if (depth === 0) return str.slice(start, i + 1); }
        }
        i++;
    }
    return null;
}

/**
 * Parse a simple JS object literal (non-nested string values, numbers, arrays of primitives)
 * Good enough for the character data structure.
 */
function parseSimpleJsObj(objStr) {
    // Convert JS object syntax to JSON
    // Handle: unquoted keys, trailing commas, single-quoted strings, /path/..., numeric keys
    let json = objStr;
    // Quote unquoted keys: word: → "word":
    json = json.replace(/([{,\s])(\w+)\s*:/g, '$1"$2":');
    // Replace single quotes with double quotes (simple cases)
    json = json.replace(/'/g, '"');
    // Remove trailing commas before } or ]
    json = json.replace(/,\s*([}\]])/g, '$1');
    try {
        return JSON.parse(json);
    } catch {
        return null;
    }
}

/**
 * Normalise an Enka path like "/ui/Skill_A_Catalyst_MD.png" → "Skill_A_Catalyst_MD"
 * Handles both "/ui/NAME.png" and bare "NAME" formats.
 */
function normIconPath(path) {
    if (!path || path === 'None') return path;
    return path.replace(/^\/ui\//, '').replace(/\.png$/, '');
}

/**
 * Derive character name from SideIconName path.
 * "/ui/UI_AvatarIcon_Side_Columbina.png" → "Columbina"
 * "/ui/UI_AvatarIcon_Side_Hu_tao.png" → "Hu Tao"
 */
function nameFromSideIcon(sideIconName) {
    if (!sideIconName) return null;
    const bare = normIconPath(sideIconName);
    const match = bare.match(/UI_AvatarIcon_Side_(.+)$/i);
    if (!match) return null;
    return match[1]
        .split('_')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ')
        .trim();
}

/**
 * Extract all character entries (avatarId 10000001 – 10009999) from the content
 */
function extractCharacters(content) {
    const chars = {};
    // Match pattern: \s10000\d{3}: {
    const charPattern = /\b(1000\d{4})\s*:\s*\{/g;
    let match;
    while ((match = charPattern.exec(content)) !== null) {
        const avatarId = match[1];
        const objStart = match.index + match[0].length - 1; // position of '{'
        const objStr = extractObject(content, objStart);
        if (!objStr) continue;

        // Extract specific fields with simple regex (more robust than full parse)
        const element = (objStr.match(/"?Element"?\s*:\s*"([^"]+)"/) || [])[1] || null;
        const sideIcon = (objStr.match(/"?SideIconName"?\s*:\s*"([^"]+)"/) || [])[1] || null;
        const quality = (objStr.match(/"?QualityType"?\s*:\s*"([^"]+)"/) || [])[1] || null;
        const weaponType = (objStr.match(/"?WeaponType"?\s*:\s*"([^"]+)"/) || [])[1] || null;
        const nameHash = (objStr.match(/"?NameTextMapHash"?\s*:\s*(\d+)/) || [])[1] || null;

        // Extract SkillOrder array
        const skillOrderMatch = objStr.match(/"?SkillOrder"?\s*:\s*\[([^\]]*)\]/);
        const skillOrder = skillOrderMatch
            ? skillOrderMatch[1].split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n))
            : [];

        // Extract Skills map: { id: "/path" }
        const skillsMatch = objStr.match(/"?Skills"?\s*:\s*(\{[^}]*\})/);
        const skills = {};
        if (skillsMatch) {
            const sm = skillsMatch[1];
            let km;
            const kp = /(\d+)\s*:\s*"([^"]+)"/g;
            while ((km = kp.exec(sm)) !== null) skills[km[1]] = km[2];
        }

        // Extract Consts array
        const constsMatch = objStr.match(/"?Consts"?\s*:\s*(\[[^\]]*\])/);
        const consts = [];
        if (constsMatch) {
            const cm = constsMatch[1];
            let km;
            const cp = /"([^"]+)"/g;
            while ((km = cp.exec(cm)) !== null) consts.push(km[1]);
        }

        const name = nameFromSideIcon(sideIcon);
        const normSideIcon = normIconPath(sideIcon);

        // Normalise Skills values: "/ui/Skill_A_Catalyst_MD.png" → "Skill_A_Catalyst_MD"
        const normSkills = {};
        for (const [k, v] of Object.entries(skills)) normSkills[k] = normIconPath(v);

        // Normalise Consts entries
        const normConsts = consts.map(normIconPath);

        // Build entry matching the GitHub characters.json shape, with extra _derivedName
        chars[avatarId] = {
            _derivedName: name,   // fallback when loc.json hash is missing
            NameTextMapHash: nameHash ? Number(nameHash) : null,
            Element: element,
            SideIconName: normSideIcon,   // bare: "UI_AvatarIcon_Side_Columbina"
            QualityType: quality,
            WeaponType: weaponType,
            SkillOrder: skillOrder,
            Skills: normSkills,           // bare: { "11251": "Skill_A_Catalyst_MD" }
            Consts: normConsts,           // bare: ["UI_Talent_S_Columbina_01", ...]
        };
    }
    return chars;
}

/**
 * Extract weapon entries (itemId 1xxxx – 1xxxxx for weapons)
 * Weapons have a `WeaponType: number` field and an `Icon` field
 */
function extractWeapons(content) {
    const weapons = {};
    // Weapon pattern: typically 5-digit IDs like 14522, 11501, etc.
    const wPattern = /\b(1[0-9]{4})\s*:\s*\{/g;
    let match;
    while ((match = wPattern.exec(content)) !== null) {
        const itemId = match[1];
        const objStart = match.index + match[0].length - 1;
        const objStr = extractObject(content, objStart);
        if (!objStr) continue;
        // Weapons have numeric WeaponType and Icon fields
        const weaponType = (objStr.match(/"?WeaponType"?\s*:\s*(\d+)/) || [])[1];
        if (!weaponType) continue;
        const icon = (objStr.match(/"?Icon"?\s*:\s*"([^"]+)"/) || [])[1] || null;
        const nameHash = (objStr.match(/"?NameTextMapHash"?\s*:\s*(\d+)/) || [])[1] || null;
        const rarity = (objStr.match(/"?Rarity"?\s*:\s*(\d+)/) || [])[1] || null;

        weapons[itemId] = {
            Icon: normIconPath(icon),
            AwakenIcon: (objStr.match(/"?AwakenIcon"?\s*:\s*"([^"]+)"/) || [])[1] ? normIconPath((objStr.match(/"?AwakenIcon"?\s*:\s*"([^"]+)"/) || [])[1]) : null,
            NameTextMapHash: nameHash ? Number(nameHash) : null,
            RankLevel: rarity ? Number(rarity) : null,
            WeaponType: Number(weaponType),
        };
    }
    return weapons;
}

/**
 * Extract profile pictures (pfps): tiny `<id>: { IconPath: "/ui/UI_AvatarIcon_..._Circle.png" }` entries.
 * Strips "/ui/", ".png" and the trailing "_Circle" so the bare icon name matches pfps.json convention.
 */
function extractPfps(content) {
    const pfps = {};
    const re = /\b(\d{3,7})\s*:\s*\{\s*IconPath\s*:\s*"([^"]+)"\s*\}/g;
    let m;
    while ((m = re.exec(content)) !== null) {
        const id = m[1];
        const bare = (normIconPath(m[2]) || '').replace(/_Circle$/, '');
        if (bare) pfps[id] = bare;
    }
    return pfps;
}

console.log('Extracting characters...');
const characters = extractCharacters(content);
console.log('Extracted', Object.keys(characters).length, 'characters');

console.log('Extracting weapons...');
const weapons = extractWeapons(content);
console.log('Extracted', Object.keys(weapons).length, 'weapons');

console.log('Extracting profile pictures...');
const pfps = extractPfps(content);
console.log('Extracted', Object.keys(pfps).length, 'pfps');

const output = { characters, weapons, pfps, extractedAt: new Date().toISOString() };
fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
console.log('\nSaved to:', outputFile);
