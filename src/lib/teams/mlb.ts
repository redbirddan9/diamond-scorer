/**
 * Static MLB club data. Fully offline: no images, no network.
 * Brand colors are raw hex on purpose — they are club identity data,
 * not theme tokens, and are only used inside the drawn team mark.
 */
export interface MlbTeam {
  id: string;
  city: string;
  nickname: string;
  /** Full display name, e.g. "Los Angeles Dodgers". */
  name: string;
  /** Cap letters drawn inside the mark. */
  cap: string;
  primary: string;
  secondary: string;
  division: string;
}

export const MLB_TEAMS: MlbTeam[] = [
  { id: "BAL", city: "Baltimore", nickname: "Orioles", name: "Baltimore Orioles", cap: "BAL", primary: "#DF4601", secondary: "#FFFFFF", division: "AL East" },
  { id: "BOS", city: "Boston", nickname: "Red Sox", name: "Boston Red Sox", cap: "B", primary: "#BD3039", secondary: "#FFFFFF", division: "AL East" },
  { id: "NYY", city: "New York", nickname: "Yankees", name: "New York Yankees", cap: "NY", primary: "#132448", secondary: "#FFFFFF", division: "AL East" },
  { id: "TB", city: "Tampa Bay", nickname: "Rays", name: "Tampa Bay Rays", cap: "TB", primary: "#092C5C", secondary: "#8FBCE6", division: "AL East" },
  { id: "TOR", city: "Toronto", nickname: "Blue Jays", name: "Toronto Blue Jays", cap: "TOR", primary: "#134A8E", secondary: "#FFFFFF", division: "AL East" },

  { id: "CWS", city: "Chicago", nickname: "White Sox", name: "Chicago White Sox", cap: "SOX", primary: "#27251F", secondary: "#C4CED4", division: "AL Central" },
  { id: "CLE", city: "Cleveland", nickname: "Guardians", name: "Cleveland Guardians", cap: "C", primary: "#00385D", secondary: "#E50022", division: "AL Central" },
  { id: "DET", city: "Detroit", nickname: "Tigers", name: "Detroit Tigers", cap: "D", primary: "#0C2340", secondary: "#FA4616", division: "AL Central" },
  { id: "KC", city: "Kansas City", nickname: "Royals", name: "Kansas City Royals", cap: "KC", primary: "#004687", secondary: "#BD9B60", division: "AL Central" },
  { id: "MIN", city: "Minnesota", nickname: "Twins", name: "Minnesota Twins", cap: "TC", primary: "#002B5C", secondary: "#D31145", division: "AL Central" },

  { id: "ATH", city: "Athletics", nickname: "Athletics", name: "Athletics", cap: "A", primary: "#003831", secondary: "#EFB21E", division: "AL West" },
  { id: "HOU", city: "Houston", nickname: "Astros", name: "Houston Astros", cap: "H", primary: "#002D62", secondary: "#EB6E1F", division: "AL West" },
  { id: "LAA", city: "Los Angeles", nickname: "Angels", name: "Los Angeles Angels", cap: "A", primary: "#BA0021", secondary: "#FFFFFF", division: "AL West" },
  { id: "SEA", city: "Seattle", nickname: "Mariners", name: "Seattle Mariners", cap: "S", primary: "#0C2C56", secondary: "#005C5C", division: "AL West" },
  { id: "TEX", city: "Texas", nickname: "Rangers", name: "Texas Rangers", cap: "T", primary: "#003278", secondary: "#C0111F", division: "AL West" },

  { id: "ATL", city: "Atlanta", nickname: "Braves", name: "Atlanta Braves", cap: "A", primary: "#13274F", secondary: "#CE1141", division: "NL East" },
  { id: "MIA", city: "Miami", nickname: "Marlins", name: "Miami Marlins", cap: "M", primary: "#00A3E0", secondary: "#000000", division: "NL East" },
  { id: "NYM", city: "New York", nickname: "Mets", name: "New York Mets", cap: "NY", primary: "#002D72", secondary: "#FF5910", division: "NL East" },
  { id: "PHI", city: "Philadelphia", nickname: "Phillies", name: "Philadelphia Phillies", cap: "P", primary: "#E81828", secondary: "#FFFFFF", division: "NL East" },
  { id: "WSH", city: "Washington", nickname: "Nationals", name: "Washington Nationals", cap: "W", primary: "#AB0003", secondary: "#FFFFFF", division: "NL East" },

  { id: "CHC", city: "Chicago", nickname: "Cubs", name: "Chicago Cubs", cap: "C", primary: "#0E3386", secondary: "#CC3433", division: "NL Central" },
  { id: "CIN", city: "Cincinnati", nickname: "Reds", name: "Cincinnati Reds", cap: "C", primary: "#C6011F", secondary: "#FFFFFF", division: "NL Central" },
  { id: "MIL", city: "Milwaukee", nickname: "Brewers", name: "Milwaukee Brewers", cap: "M", primary: "#12284B", secondary: "#FFC52F", division: "NL Central" },
  { id: "PIT", city: "Pittsburgh", nickname: "Pirates", name: "Pittsburgh Pirates", cap: "P", primary: "#27251F", secondary: "#FDB827", division: "NL Central" },
  { id: "STL", city: "St. Louis", nickname: "Cardinals", name: "St. Louis Cardinals", cap: "STL", primary: "#C41E3A", secondary: "#FFFFFF", division: "NL Central" },

  { id: "ARI", city: "Arizona", nickname: "Diamondbacks", name: "Arizona Diamondbacks", cap: "A", primary: "#A71930", secondary: "#E3D4AD", division: "NL West" },
  { id: "COL", city: "Colorado", nickname: "Rockies", name: "Colorado Rockies", cap: "CR", primary: "#333366", secondary: "#C4CED4", division: "NL West" },
  { id: "LAD", city: "Los Angeles", nickname: "Dodgers", name: "Los Angeles Dodgers", cap: "LA", primary: "#005A9C", secondary: "#FFFFFF", division: "NL West" },
  { id: "SD", city: "San Diego", nickname: "Padres", name: "San Diego Padres", cap: "SD", primary: "#2F241D", secondary: "#FFC425", division: "NL West" },
  { id: "SF", city: "San Francisco", nickname: "Giants", name: "San Francisco Giants", cap: "SF", primary: "#27251F", secondary: "#FD5A1E", division: "NL West" },
];

export const MLB_DIVISIONS = [
  "AL East",
  "AL Central",
  "AL West",
  "NL East",
  "NL Central",
  "NL West",
];

export function teamById(id?: string): MlbTeam | undefined {
  if (!id) return undefined;
  return MLB_TEAMS.find((t) => t.id === id);
}

export function teamsByDivision(division: string): MlbTeam[] {
  return MLB_TEAMS.filter((t) => t.division === division);
}