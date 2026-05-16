// Format legality logic — shared between frontend and label generator
// This file must be usable in both browser (as a script) and Node.js

const EXCLUDED_SET_TYPES = new Set([
  'token', 'memorabilia', 'minigame', 'vanguard',
  'planechase', 'archenemy', 'funny'
]);

const HISTORIC_CUTOFF = '2017-09-29'; // Ixalan release date

// Standard rotation boundary — kept in sync with config.js
// Sets of type expansion/core released on or after this date are Standard-legal.
// Update after each fall rotation.
const STANDARD_CUTOFF_DATE = '2023-09-08'; // Wilds of Eldraine

const STANDARD_SET_TYPES = new Set(['expansion', 'core']);
const PLAY_SET_TYPES = new Set(['expansion', 'core', 'starter']);
// Excluded from Play despite being core/expansion: non-tournament-legal printings
const PLAY_EXCLUDED_CODES = new Set(['3ed', 'fbb', 'sum', '4ed', '4bb', 'itp','5ed','por','p02','6ed','ptk','s99','s00','7ed','8ed','9ed','10e','cp1','cp2','cp3','w16','w17']);
                   // we may want to include 10e?

function isLegacyLegal(set) {
  if (set.digital) return false;
  if (EXCLUDED_SET_TYPES.has(set.set_type)) return false;
  return true;
}

function isVintageLegal(set) {
  return isLegacyLegal(set);
}

function isHistoricLegal(set) {
  if (!isLegacyLegal(set)) return false;
  if (set.arena_code) return true;
  const arenaTypes = new Set(['expansion', 'core', 'masters', 'draft_innovation']);
  if (arenaTypes.has(set.set_type) && set.released_at >= HISTORIC_CUTOFF) return true;
  return false;
}

function isStandardLegal(set) {
  if (set.digital) return false;
  if (!STANDARD_SET_TYPES.has(set.set_type)) return false;
  if (!set.released_at) return false;
  return set.released_at >= STANDARD_CUTOFF_DATE;
}

function isPlayLegal(set) {
  if (set.digital) return false;
  if (PLAY_EXCLUDED_CODES.has(set.code.toLowerCase())) return false;
  return PLAY_SET_TYPES.has(set.set_type);
}

function getSetFormats(set) {
  return {
    standard: isStandardLegal(set),
    play:     isPlayLegal(set),
    legacy:   isLegacyLegal(set),
    vintage:  isVintageLegal(set),
  };
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getSetFormats, isLegacyLegal, isVintageLegal, isHistoricLegal, isStandardLegal, isPlayLegal };
}
