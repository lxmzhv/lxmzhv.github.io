import { GUILD_FILES, PLATOON_TO_ROSTER_ID_MAP } from '../constants.js';
import { getUnitDisplayName } from '../logic/player.js';

export function fetchGuildList() {
  const promises = GUILD_FILES.map(file => fetch(`guilds/${file}`).then(res => res.json()));
  return Promise.all(promises).then(guildDataArray => {
    return guildDataArray.map(data => ({
      id: data.profile.id,
      name: data.profile.name,
      fileName: `guild_${data.profile.id}.json`
    }));
  });
}

export function fetchGuildData(guildId, onProgress) {
  const guildFile = `guild_${guildId}.json`;

  return fetch(`guilds/${guildFile}`)
    .then(response => response.json())
    .then(guildData => {
      const totalPlayers = guildData.member.length;
      if (totalPlayers === 0) {
        return { guildData, players: [] };
      }

      let loadedPlayers = 0;
      const playerPromises = guildData.member.map(player => {
        const playerId = player.playerId;
        return fetch(`guilds/player_id_${playerId}.json`)
          .then(response => {
            if (!response.ok) {
              return { ...player, allyCode: '' }; // Player file not found
            }
            return response.json().then(playerData => ({ ...playerData, ...player }));
          })
          .catch(() => ({ ...player, allyCode: '' })) // Handle fetch error
          .finally(() => {
            loadedPlayers++;
            if (onProgress) {
              onProgress(loadedPlayers, totalPlayers);
            }
          });
      });

      return Promise.all(playerPromises).then(players => ({ guildData, players }));
    });
}

export function fetchPlatoonData(planetToRoundMap) {
  const phaseToRelic = { 1: 5, 2: 6, 3: 7, 4: 8, 5: 9, 6: 9 };

  return fetch('../data/tb/rote_platoons.tsv')
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to load rote_platoons.tsv');
      }
      return response.text();
    })
    .then(tsvData => {
      const platoonRequirements = { 1: {}, 2: {}, 3: {}, 4: {}, 5: {}, 6: {} };
      const planetStats = {};
      const shipBaseIds = new Set(); // We can collect ship IDs here if needed, or rely on player roster

      // We need to know which units are ships to set the correct requirement level (7 stars vs Relic)
      // However, in the original code, `shipBaseIds` was populated from player data.
      // Here we might need to rely on the fact that we will have player data available or pass it in.
      // Actually, the original code populated `shipBaseIds` from player data BEFORE calling `loadPlatoonData`.
      // But `loadPlatoonData` uses `shipBaseIds` to determine if a unit is a ship.
      // So we need to pass `shipBaseIds` to this function or return a structure that allows processing later.
      // Let's return the raw parsed data and process it with `shipBaseIds` later?
      // Or better, let's just parse it here and we might need to pass `shipBaseIds` as an argument.

      // Wait, `loadPlatoonData` in original code accessed `shipBaseIds` which was global.
      // So we MUST pass `shipBaseIds` to this function.

      // But wait, `shipBaseIds` is populated from PLAYERS.
      // So `fetchPlatoonData` should probably be called AFTER `fetchGuildData`.

      // Let's change the signature to accept `shipBaseIds`.

      return { tsvData, phaseToRelic };
    });
}

export function processPlatoonData(tsvData, planetToRoundMap, shipBaseIds) {
  const phaseToRelic = { 1: 5, 2: 6, 3: 7, 4: 8, 5: 9, 6: 9 };
  const platoonRequirements = { 1: {}, 2: {}, 3: {}, 4: {}, 5: {}, 6: {} };
  const planetStats = {};

  // Helper to get unit display name - we might not have access to `getUnitDisplayName` here easily if we want to keep it pure?
  // We can import it.
  // Actually, let's just return the data structure and let the UI/Logic layer handle display names if possible,
  // OR just import `getUnitDisplayName`.

  const lines = tsvData.split('\n');

  lines.forEach(line => {
    const columns = line.split('\t');
    if (columns.length < 8) return;

    const alignment = columns[0];
    const planetPhase = parseInt(columns[1], 10);
    const planetName = columns[2].replace(/"/g, '');
    let unitId = columns[7].toLowerCase();

    const rounds = planetToRoundMap[planetName.toLowerCase()] || [];
    const firstActiveRound = rounds.length > 0 ? rounds[0] : 0;

    if (PLATOON_TO_ROSTER_ID_MAP[unitId]) {
      unitId = PLATOON_TO_ROSTER_ID_MAP[unitId];
    }

    const isShip = shipBaseIds.has(unitId);
    const requiredLevel = isShip ? 7 : phaseToRelic[planetPhase];

    if (!requiredLevel) return;

    // For main platoon requirement logic - only add if planet is active
    if (firstActiveRound > 0 && platoonRequirements[firstActiveRound]) {
      const reqs = platoonRequirements[firstActiveRound];
      if (!reqs[unitId]) reqs[unitId] = {};
      if (!reqs[unitId][requiredLevel]) reqs[unitId][requiredLevel] = 0;
      reqs[unitId][requiredLevel]++;
    }

    // For debug table and planet config - always populate
    if (!planetStats[planetName]) {
      const planetRelicReq = phaseToRelic[planetPhase];
      planetStats[planetName] = {
        name: planetName,
        alignment: alignment,
        phase: planetPhase,
        relic: `R${planetRelicReq}`,
        units: []
      };
    }
    // Always update rounds and firstActiveRound as they are dynamic
    planetStats[planetName].round = firstActiveRound;
    planetStats[planetName].rounds = rounds;

    planetStats[planetName].units.push({
      unitId: unitId,
      name: getUnitDisplayName(unitId)
    });
  });

  return { platoonRequirements, planetStats };
}
