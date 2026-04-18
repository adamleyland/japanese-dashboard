"use client";

const DIGRAPH_ROMAJI = {
  "\u304d\u3083": "kya",
  "\u304d\u3085": "kyu",
  "\u304d\u3087": "kyo",
  "\u304e\u3083": "gya",
  "\u304e\u3085": "gyu",
  "\u304e\u3087": "gyo",
  "\u3057\u3083": "sha",
  "\u3057\u3085": "shu",
  "\u3057\u3087": "sho",
  "\u3058\u3083": "ja",
  "\u3058\u3085": "ju",
  "\u3058\u3087": "jo",
  "\u3061\u3083": "cha",
  "\u3061\u3085": "chu",
  "\u3061\u3087": "cho",
  "\u306b\u3083": "nya",
  "\u306b\u3085": "nyu",
  "\u306b\u3087": "nyo",
  "\u3072\u3083": "hya",
  "\u3072\u3085": "hyu",
  "\u3072\u3087": "hyo",
  "\u3073\u3083": "bya",
  "\u3073\u3085": "byu",
  "\u3073\u3087": "byo",
  "\u3074\u3083": "pya",
  "\u3074\u3085": "pyu",
  "\u3074\u3087": "pyo",
  "\u307f\u3083": "mya",
  "\u307f\u3085": "myu",
  "\u307f\u3087": "myo",
  "\u308a\u3083": "rya",
  "\u308a\u3085": "ryu",
  "\u308a\u3087": "ryo",
};

const KANA_ROMAJI = {
  "\u3042": "a",
  "\u3044": "i",
  "\u3046": "u",
  "\u3048": "e",
  "\u304a": "o",
  "\u304b": "ka",
  "\u304d": "ki",
  "\u304f": "ku",
  "\u3051": "ke",
  "\u3053": "ko",
  "\u304c": "ga",
  "\u304e": "gi",
  "\u3050": "gu",
  "\u3052": "ge",
  "\u3054": "go",
  "\u3055": "sa",
  "\u3057": "shi",
  "\u3059": "su",
  "\u305b": "se",
  "\u305d": "so",
  "\u3056": "za",
  "\u3058": "ji",
  "\u305a": "zu",
  "\u305c": "ze",
  "\u305e": "zo",
  "\u305f": "ta",
  "\u3061": "chi",
  "\u3064": "tsu",
  "\u3066": "te",
  "\u3068": "to",
  "\u3060": "da",
  "\u3062": "ji",
  "\u3065": "zu",
  "\u3067": "de",
  "\u3069": "do",
  "\u306a": "na",
  "\u306b": "ni",
  "\u306c": "nu",
  "\u306d": "ne",
  "\u306e": "no",
  "\u306f": "ha",
  "\u3072": "hi",
  "\u3075": "fu",
  "\u3078": "he",
  "\u307b": "ho",
  "\u3070": "ba",
  "\u3073": "bi",
  "\u3076": "bu",
  "\u3079": "be",
  "\u307c": "bo",
  "\u3071": "pa",
  "\u3074": "pi",
  "\u3077": "pu",
  "\u307a": "pe",
  "\u307d": "po",
  "\u307e": "ma",
  "\u307f": "mi",
  "\u3080": "mu",
  "\u3081": "me",
  "\u3082": "mo",
  "\u3084": "ya",
  "\u3086": "yu",
  "\u3088": "yo",
  "\u3089": "ra",
  "\u308a": "ri",
  "\u308b": "ru",
  "\u308c": "re",
  "\u308d": "ro",
  "\u308f": "wa",
  "\u3092": "wo",
  "\u3093": "n",
  "\u3094": "vu",
  "\u3041": "a",
  "\u3043": "i",
  "\u3045": "u",
  "\u3047": "e",
  "\u3049": "o",
  "\u3083": "ya",
  "\u3085": "yu",
  "\u3087": "yo",
};

const ROMAJI_HIRAGANA = {
  a: "\u3042",
  i: "\u3044",
  u: "\u3046",
  e: "\u3048",
  o: "\u304a",
  ka: "\u304b",
  ki: "\u304d",
  ku: "\u304f",
  ke: "\u3051",
  ko: "\u3053",
  ga: "\u304c",
  gi: "\u304e",
  gu: "\u3050",
  ge: "\u3052",
  go: "\u3054",
  sa: "\u3055",
  shi: "\u3057",
  si: "\u3057",
  su: "\u3059",
  se: "\u305b",
  so: "\u305d",
  za: "\u3056",
  ji: "\u3058",
  zi: "\u3058",
  zu: "\u305a",
  ze: "\u305c",
  zo: "\u305e",
  ta: "\u305f",
  chi: "\u3061",
  ti: "\u3061",
  tsu: "\u3064",
  tu: "\u3064",
  te: "\u3066",
  to: "\u3068",
  da: "\u3060",
  de: "\u3067",
  do: "\u3069",
  na: "\u306a",
  ni: "\u306b",
  nu: "\u306c",
  ne: "\u306d",
  no: "\u306e",
  ha: "\u306f",
  hi: "\u3072",
  fu: "\u3075",
  hu: "\u3075",
  he: "\u3078",
  ho: "\u307b",
  ba: "\u3070",
  bi: "\u3073",
  bu: "\u3076",
  be: "\u3079",
  bo: "\u307c",
  pa: "\u3071",
  pi: "\u3074",
  pu: "\u3077",
  pe: "\u307a",
  po: "\u307d",
  ma: "\u307e",
  mi: "\u307f",
  mu: "\u3080",
  me: "\u3081",
  mo: "\u3082",
  ya: "\u3084",
  yu: "\u3086",
  yo: "\u3088",
  ra: "\u3089",
  ri: "\u308a",
  ru: "\u308b",
  re: "\u308c",
  ro: "\u308d",
  wa: "\u308f",
  wo: "\u3092",
  n: "\u3093",
  nn: "\u3093",
  kya: "\u304d\u3083",
  kyu: "\u304d\u3085",
  kyo: "\u304d\u3087",
  gya: "\u304e\u3083",
  gyu: "\u304e\u3085",
  gyo: "\u304e\u3087",
  sha: "\u3057\u3083",
  shu: "\u3057\u3085",
  sho: "\u3057\u3087",
  sya: "\u3057\u3083",
  syu: "\u3057\u3085",
  syo: "\u3057\u3087",
  ja: "\u3058\u3083",
  ju: "\u3058\u3085",
  jo: "\u3058\u3087",
  jya: "\u3058\u3083",
  jyu: "\u3058\u3085",
  jyo: "\u3058\u3087",
  cha: "\u3061\u3083",
  chu: "\u3061\u3085",
  cho: "\u3061\u3087",
  cya: "\u3061\u3083",
  cyu: "\u3061\u3085",
  cyo: "\u3061\u3087",
  nya: "\u306b\u3083",
  nyu: "\u306b\u3085",
  nyo: "\u306b\u3087",
  hya: "\u3072\u3083",
  hyu: "\u3072\u3085",
  hyo: "\u3072\u3087",
  bya: "\u3073\u3083",
  byu: "\u3073\u3085",
  byo: "\u3073\u3087",
  pya: "\u3074\u3083",
  pyu: "\u3074\u3085",
  pyo: "\u3074\u3087",
  mya: "\u307f\u3083",
  myu: "\u307f\u3085",
  myo: "\u307f\u3087",
  rya: "\u308a\u3083",
  ryu: "\u308a\u3085",
  ryo: "\u308a\u3087",
  fa: "\u3075\u3041",
  fi: "\u3075\u3043",
  fe: "\u3075\u3047",
  fo: "\u3075\u3049",
  va: "\u3094\u3041",
  vi: "\u3094\u3043",
  ve: "\u3094\u3047",
  vo: "\u3094\u3049",
};

const ROMAJI_KEYS = Object.keys(ROMAJI_HIRAGANA).sort((a, b) => b.length - a.length);
const SMALL_TSU = "\u3063";
const LONG_VOWEL_MARK = "\u30fc";
const KANA_RANGE = /[\u3040-\u30ff]/;
const KATAKANA_RANGE = /[\u30a1-\u30f6]/g;
const ASCII_LETTER = /^[a-z]$/i;
const VOWEL = /[aeiou]/;
const SQUEEZE_PATTERN = /[\s"'`.,!?()[\]{}\-_/\\]+/g;

function collapseWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function squeezeSearchValue(value) {
  return value.replace(SQUEEZE_PATTERN, "");
}

function isKana(value) {
  return KANA_RANGE.test(value);
}

function isAsciiLetter(value) {
  return ASCII_LETTER.test(value);
}

function isVowel(value) {
  return VOWEL.test(value);
}

function toHiragana(value) {
  return value.replace(KATAKANA_RANGE, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0x60),
  );
}

function kanaToRomaji(value) {
  const hira = toHiragana(value);
  let output = "";

  for (let index = 0; index < hira.length; index += 1) {
    const current = hira[index];
    const digraph = hira.slice(index, index + 2);

    if (current === SMALL_TSU) {
      const nextDigraph = DIGRAPH_ROMAJI[hira.slice(index + 1, index + 3)];
      const nextRomaji = nextDigraph || KANA_ROMAJI[hira[index + 1]] || "";
      if (nextRomaji) {
        output += nextRomaji[0];
      }
      continue;
    }

    if (current === LONG_VOWEL_MARK) {
      const trailingVowel = output.match(/[aeiou]$/)?.[0];
      if (trailingVowel) {
        output += trailingVowel;
      }
      continue;
    }

    if (DIGRAPH_ROMAJI[digraph]) {
      output += DIGRAPH_ROMAJI[digraph];
      index += 1;
      continue;
    }

    output += KANA_ROMAJI[current] || current;
  }

  return output;
}

function romajiToHiragana(value) {
  const normalized = collapseWhitespace(value.normalize("NFKC").toLowerCase());
  let output = "";

  for (let index = 0; index < normalized.length; ) {
    const current = normalized[index];
    const next = normalized[index + 1];

    if (!isAsciiLetter(current)) {
      output += toHiragana(current);
      index += 1;
      continue;
    }

    if (
      current === next &&
      current !== "n" &&
      isAsciiLetter(current) &&
      !isVowel(current)
    ) {
      output += SMALL_TSU;
      index += 1;
      continue;
    }

    if (
      current === "n" &&
      (!next || (isAsciiLetter(next) && !/[aiueoy]/.test(next)) || next === "'")
    ) {
      output += "\u3093";
      index += next === "'" ? 2 : 1;
      continue;
    }

    const chunk = ROMAJI_KEYS.find((key) => normalized.startsWith(key, index));
    if (chunk) {
      output += ROMAJI_HIRAGANA[chunk];
      index += chunk.length;
      continue;
    }

    output += current;
    index += 1;
  }

  return output;
}

function buildVariants(value) {
  const normalized = collapseWhitespace(String(value || "").normalize("NFKC").toLowerCase());
  if (!normalized) {
    return [];
  }

  const hiragana = toHiragana(normalized);
  const romaji = isKana(hiragana) ? kanaToRomaji(hiragana) : normalized;
  const romajiHiragana = romajiToHiragana(normalized);
  const romajiFromRomajiHiragana = kanaToRomaji(romajiHiragana);

  return [
    normalized,
    squeezeSearchValue(normalized),
    hiragana,
    squeezeSearchValue(hiragana),
    romaji,
    squeezeSearchValue(romaji),
    romajiHiragana,
    squeezeSearchValue(romajiHiragana),
    romajiFromRomajiHiragana,
    squeezeSearchValue(romajiFromRomajiHiragana),
  ].filter(Boolean);
}

export function buildJapaneseSearchIndex(values) {
  const tokens = new Set();

  values.forEach((value) => {
    buildVariants(value).forEach((token) => {
      tokens.add(token);
    });
  });

  return Array.from(tokens);
}

export function matchesJapaneseSearch(query, searchIndex) {
  const queryTokens = buildJapaneseSearchIndex([query]);
  if (!queryTokens.length) {
    return true;
  }

  return queryTokens.some((queryToken) =>
    searchIndex.some((candidate) => candidate.includes(queryToken)),
  );
}
