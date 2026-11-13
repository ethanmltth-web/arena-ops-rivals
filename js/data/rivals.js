/** Roblox Rivals game definition, signature stars, and name pools */

export const RIVALS = {
  id: 'rivals',
  name: 'Roblox Rivals',
  rosterSize: 5,
  maxRoster: 8,
  seasonWeeks: 14,
  maps: ['Neon Alley', 'Skybridge', 'Cargo Yard', 'Frost Pier', 'Temple Run', 'Voltage'],
  roles: ['Duelist', 'Controller', 'Support', 'Flex', 'Entry'],
  stats: ['aim', 'movement', 'mechanics', 'gameSense', 'teamwork', 'morale', 'energy'],
  statLabels: {
    aim: 'Aim',
    movement: 'Movement',
    mechanics: 'Mechanics',
    gameSense: 'Game Sense',
    teamwork: 'Teamwork',
    morale: 'Morale',
    energy: 'Energy',
  },
  /** Weights for overall rating (exclude morale/energy) */
  ovrWeights: {
    aim: 0.25,
    movement: 0.2,
    mechanics: 0.2,
    gameSense: 0.2,
    teamwork: 0.15,
  },
};

export const FIRST_NAMES = [
  'Aiden', 'Kai', 'Nova', 'Rex', 'Jade', 'Orion', 'Mira', 'Zane', 'Luna', 'Ash',
  'Finn', 'Riven', 'Skye', 'Dex', 'Nyx', 'Cole', 'Vera', 'Jett', 'Blaze', 'Echo',
  'Torin', 'Sable', 'Quinn', 'Hex', 'Rae', 'Kian', 'Ivy', 'Voss', 'Niko', 'Tess',
];

export const LAST_NAMES = [
  'Volt', 'Drift', 'Shade', 'Pulse', 'Frost', 'Rogue', 'Spark', 'Cinder', 'Hawk',
  'Storm', 'Pixel', 'Blade', 'Nova', 'Rush', 'Glitch', 'Forge', 'Shift', 'Dash',
  'Arc', 'Flux', 'Ridge', 'Wren', 'Knox', 'Pike', 'Vale', 'Cruz', 'Reed', 'Sol',
];

export const AI_TEAM_NAMES = [
  'Crimson Circuit', 'Zero Latency', 'Pixel Predators', 'Frostbyte FC',
  'Orbit Syndicate', 'Void Runners', 'Hyperlane', 'Static Force',
];

/**
 * Real-ish signature players for Rivals.
 * Higher base stats + premium signing fee / salary.
 */
export const SIGNATURE_PLAYERS = [
  {
    id: 'sig-swift',
    name: 'Swift',
    role: 'Duelist',
    signature: true,
    bio: 'Elite aim duelist. Known for clutch multi-kills and aggressive site takes.',
    base: { aim: 94, movement: 90, mechanics: 91, gameSense: 86, teamwork: 78, morale: 85, energy: 88 },
    potential: 96,
    signingFee: 185000,
    salary: 12000,
  },
  {
    id: 'sig-slingshot',
    name: 'SlingshotBwai',
    role: 'Flex',
    signature: true,
    bio: 'Mechanical flex star. Can frag or set up teammates depending on the map.',
    base: { aim: 88, movement: 92, mechanics: 95, gameSense: 90, teamwork: 84, morale: 82, energy: 86 },
    potential: 97,
    signingFee: 175000,
    salary: 11500,
  },
  {
    id: 'sig-vortex',
    name: 'VortexRLX',
    role: 'Controller',
    signature: true,
    bio: 'IGL-minded controller with elite utility timing and mid-round calls.',
    base: { aim: 82, movement: 84, mechanics: 86, gameSense: 94, teamwork: 93, morale: 88, energy: 84 },
    potential: 94,
    signingFee: 140000,
    salary: 9500,
  },
];
