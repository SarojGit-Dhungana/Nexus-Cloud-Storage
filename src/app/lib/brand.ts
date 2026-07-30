// Brand ramp shared with theme.css — dark green / pure red / black / white.
export const BRAND = {
  maroon: "#000000",
  rust: "#0A1F14",
  brick: "#145A32",
  clay: "#1B7A44",
  ember: "#FF0000",
  sand: "#3DA86A",
  bark: "#4A5C52",
};
export const BRAND_SERIES = [BRAND.brick, BRAND.ember, BRAND.clay, BRAND.maroon, BRAND.sand, BRAND.rust];
// Deeper tones only, so white initials stay legible.
export const AVATAR_COLORS = [BRAND.brick, BRAND.maroon, BRAND.clay, BRAND.rust, BRAND.bark, "#0F3322"];
export const ACTIVITY_COLORS: Record<string, string> = {
  share: BRAND.brick, upload: BRAND.clay, download: BRAND.sand,
  system: BRAND.bark, admin: BRAND.maroon, create: BRAND.sand, delete: BRAND.ember,
};
