// Standard rotation boundary — update this after each fall rotation.
// Sets released on or after this date (of type expansion/core) are Standard-legal.
// Current Standard as of 2026-03: Wilds of Eldraine (2023-09-08) is the oldest set.
const STANDARD_CUTOFF_DATE = '2023-09-08';

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { STANDARD_CUTOFF_DATE };
}
