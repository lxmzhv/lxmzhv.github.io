import {
  getRoleBackgroundColor,
  getAssaultUnitBGColor,
  getUnitBGColor,
  getShipBGColor,
  getPilotBackgroundColor,
  getOmicronDetails,
  getRareCharBackgroundColor,
  getReqBackgroundColor,
  getReqUnitBGColor,
  getShipInfo,
  getPlayerUnitInfo
} from '../logic/player.js';
import {
  ASSAULT_CHARACTERS,
  GALACTIC_LEGENDS_MAP,
  SHIPS_MAP,
  PILOTS_MAP,
  CONQUEST_UNITS_ORDER,
  CONQUEST_CHARACTERS_SET,
  CONQUEST_SHIPS_MAP,
  TEAMS,
  LEIA_TEAM_UNITS,
  JABBA_TEAM_UNITS,
  OMICRON_SKILL_MAP
} from '../constants.js';

const galacticLegends = Object.keys(GALACTIC_LEGENDS_MAP);
const ships = Object.keys(SHIPS_MAP);
const pilots = Object.keys(PILOTS_MAP);

export function renderTable(data, tbody, tbColumns, selectedPlayerId, callbacks) {
  // callbacks: { onPlayerSelect, onOmicronClick, onRareCharClick, onNewPlayerChange }

  tbody.innerHTML = '';
  data.forEach((player, index) => {
    const row = tbody.insertRow();

    if (player.playerId === selectedPlayerId) {
      row.classList.add('selected');
    }

    row.addEventListener('click', () => {
      callbacks.onPlayerSelect(player.playerId, row);
    });

    // Helper to set background color safely
    const setBgColor = (cell, color) => {
      if (!player.isEnabled) {
        cell.style.backgroundColor = '#d3d3d3'; // Grey
      } else {
        cell.style.backgroundColor = color;
      }
    };

    const enabledCell = row.insertCell();
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = player.isEnabled;
    checkbox.addEventListener('change', (e) => {
      callbacks.onEnabledChange(player.playerId, e.target.checked);
    });
    enabledCell.appendChild(checkbox);
    // enabledCell.classList.add('col-player-info'); // Removed to keep visible
    if (!player.isEnabled) enabledCell.style.backgroundColor = '#d3d3d3';

    const indexCell = row.insertCell();
    indexCell.textContent = index + 1;
    setBgColor(indexCell, 'white');
    // indexCell.classList.add('col-player-info'); // Removed to keep visible

    const playerNameCell = row.insertCell();
    const playerNameLink = document.createElement('a');
    playerNameLink.href = `https://swgoh.gg/p/${player.allyCode}/`;
    playerNameLink.textContent = player.playerName;
    playerNameLink.target = "_blank";
    playerNameCell.appendChild(playerNameLink);
    setBgColor(playerNameCell, 'white');

    const allyCodeCell = row.insertCell();
    allyCodeCell.textContent = player.allyCode;
    allyCodeCell.classList.add('col-player-info', 'separator-left');
    if (!player.isEnabled) allyCodeCell.style.backgroundColor = '#d3d3d3';

    const memberLevelCell = row.insertCell();
    memberLevelCell.textContent = player.memberLevel;
    setBgColor(memberLevelCell, getRoleBackgroundColor(player.memberLevel));
    memberLevelCell.classList.add('col-player-info');

    const gpCell = row.insertCell();
    gpCell.textContent = (player.galacticPower / 1000000).toFixed(1);
    gpCell.classList.add('col-player-info');
    if (!player.isEnabled) gpCell.style.backgroundColor = '#d3d3d3';

    const joinedCell = row.insertCell();
    joinedCell.textContent = player.joined;
    joinedCell.classList.add('col-player-info');
    if (!player.isEnabled) joinedCell.style.backgroundColor = '#d3d3d3';

    const modsCell = row.insertCell();
    modsCell.textContent = player.modsRating ? player.modsRating.toFixed(1) : '-';
    modsCell.classList.add('col-player-info', 'separator-right');
    if (!player.isEnabled) modsCell.style.backgroundColor = '#d3d3d3';

    ASSAULT_CHARACTERS.forEach((unitId, idx) => {
      const cell = row.insertCell();
      cell.classList.add('col-assaults');
      if (idx === 0) cell.classList.add('separator-left');
      cell.textContent = player[unitId].display;
      setBgColor(cell, getAssaultUnitBGColor(player[unitId]));
      if (idx === ASSAULT_CHARACTERS.length - 1) cell.classList.add('separator-right');
    });

    galacticLegends.forEach((glName, idx) => {
      const glCell = row.insertCell();
      glCell.classList.add('col-gl');
      if (idx === 0) glCell.classList.add('separator-left');
      glCell.textContent = player[glName].display;
      setBgColor(glCell, getUnitBGColor(player[glName]));
      if (idx === galacticLegends.length - 1) glCell.classList.add('separator-right');
    });

    ships.forEach((shipName, idx) => {
      const shipCell = row.insertCell();
      shipCell.classList.add('col-ships');
      if (idx === 0) shipCell.classList.add('separator-left');
      shipCell.textContent = player[shipName].display;
      setBgColor(shipCell, getShipBGColor(player[shipName]));
    });

    pilots.forEach(pilotName => {
      const pilotCell = row.insertCell();
      pilotCell.classList.add('col-ships');
      pilotCell.textContent = player[pilotName].display;
      setBgColor(pilotCell, getPilotBackgroundColor(player[pilotName]));
    });

    const totalOmicronsCell = row.insertCell();
    totalOmicronsCell.classList.add('col-tw-omicrons', 'separator-left');
    totalOmicronsCell.textContent = player.totalOmicrons;
    setBgColor(totalOmicronsCell, player.totalOmicrons > 0 ? '#7ACC7A' : '#FF9999');

    const syndullaCell = row.insertCell();
    syndullaCell.classList.add('col-tw-omicrons');
    syndullaCell.textContent = player.generalsyndullaOmicron;
    setBgColor(syndullaCell, player.generalsyndullaOmicron >= 1 ? '#7ACC7A' : '#FF9999');
    syndullaCell.style.cursor = 'pointer';
    syndullaCell.addEventListener('click', (e) => {
      e.stopPropagation();
      const details = getOmicronDetails(player, 'generalsyndulla', OMICRON_SKILL_MAP['generalsyndulla'], 6);
      callbacks.onOmicronClick(player.playerName, 'Hera Syndulla', details);
    });

    const sabineCell = row.insertCell();
    sabineCell.classList.add('col-tw-omicrons');
    sabineCell.textContent = player.padawansabineOmicron;
    setBgColor(sabineCell, player.padawansabineOmicron >= 1 ? '#7ACC7A' : '#FF9999');
    sabineCell.style.cursor = 'pointer';
    sabineCell.addEventListener('click', (e) => {
      e.stopPropagation();
      const details = getOmicronDetails(player, 'padawansabine', OMICRON_SKILL_MAP['padawansabine'], 6);
      callbacks.onOmicronClick(player.playerName, 'Sabine Wren', details);
    });

    const greatmothersCell = row.insertCell();
    greatmothersCell.classList.add('col-tw-omicrons');
    greatmothersCell.textContent = player.greatmothersOmicron;
    setBgColor(greatmothersCell, player.greatmothersOmicron >= 2 ? '#7ACC7A' :
      player.greatmothersOmicron >= 1 ? '#AAFFAA' : '#FF9999');
    greatmothersCell.style.cursor = 'pointer';
    greatmothersCell.addEventListener('click', (e) => {
      e.stopPropagation();
      const details = getOmicronDetails(player, 'greatmothers', OMICRON_SKILL_MAP['greatmothers'], 6);
      callbacks.onOmicronClick(player.playerName, 'Great Mothers', details);
    });

    const jynCell = row.insertCell();
    jynCell.classList.add('col-tw-omicrons');
    jynCell.textContent = player.jynersoOmicron;
    setBgColor(jynCell, player.jynersoOmicron >= 1 ? '#7ACC7A' : '#FF9999');
    jynCell.classList.add('separator-right');
    jynCell.style.cursor = 'pointer';
    jynCell.addEventListener('click', (e) => {
      e.stopPropagation();
      const details = getOmicronDetails(player, 'jynerso', OMICRON_SKILL_MAP['jynerso'], 7);
      callbacks.onOmicronClick(player.playerName, 'Jyn Erso', details);
    });

    CONQUEST_UNITS_ORDER.forEach((unitName, idx) => {
      const cell = row.insertCell();
      cell.classList.add('col-conquest');
      if (idx === 0) cell.classList.add('separator-left');
      if (CONQUEST_CHARACTERS_SET.has(unitName)) {
        cell.textContent = player[unitName].display;
        setBgColor(cell, getUnitBGColor(player[unitName]));
      } else if (CONQUEST_SHIPS_MAP[unitName]) {
        cell.textContent = player[unitName].display;
        setBgColor(cell, getShipBGColor(player[unitName]));
      }
      if (idx === CONQUEST_UNITS_ORDER.length - 1) cell.classList.add('separator-right');
    });

    const rareRelicLevels = [5, 6, 7, 8, 9];
    rareRelicLevels.forEach((relicLevel, idx) => {
      const cell = row.insertCell();
      cell.classList.add('col-tb-rare');
      if (idx === 0) {
        cell.classList.add('separator-left');
      }
      const count = player[`rareR${relicLevel}`];
      if (count === null) {
        cell.textContent = '-';
        if (!player.isEnabled) cell.style.backgroundColor = '#d3d3d3';
      } else {
        cell.textContent = count;
        setBgColor(cell, getRareCharBackgroundColor(count, false));
        cell.addEventListener('click', (e) => {
          e.stopPropagation();
          callbacks.onRareCharClick(player, relicLevel);
        });
      }
    });

    const totalCell = row.insertCell();
    totalCell.classList.add('col-tb-rare', 'separator-right');
    if (player.rareRTotal === null) {
      totalCell.textContent = '-';
      if (!player.isEnabled) totalCell.style.backgroundColor = '#d3d3d3';
    } else {
      totalCell.textContent = player.rareRTotal;
      setBgColor(totalCell, getRareCharBackgroundColor(player.rareRTotal, true));
      totalCell.addEventListener('click', (e) => {
        e.stopPropagation();
        callbacks.onRareCharClick(player, 'total');
      });
    }

    const newCell = row.insertCell();
    newCell.classList.add('col-tb-rare', 'separator-right');
    const newCheckbox = document.createElement('input');
    newCheckbox.type = 'checkbox';
    newCheckbox.checked = player.isNew;
    newCheckbox.addEventListener('change', () => {
      callbacks.onNewPlayerChange(player, newCheckbox.checked);
    });
    newCell.appendChild(newCheckbox);

    // Requirements
    // Average team score
    const reqAverageScoreCell = row.insertCell();
    reqAverageScoreCell.classList.add('col-requirements', 'separator-left');
    const averageScore = player['reqAverageTeamScore'];
    reqAverageScoreCell.textContent = averageScore.toFixed(0);
    setBgColor(reqAverageScoreCell, getReqBackgroundColor(averageScore));

    TEAMS.forEach((team, idx) => {
      const reqTotalCell = row.insertCell();
      reqTotalCell.classList.add('col-requirements');
      reqTotalCell.classList.add('separator-left');
      if (idx === TEAMS.length - 1) {
        reqTotalCell.classList.add('separator-right');
      }
      const score = player[`req${team}Total`];
      reqTotalCell.textContent = score.toFixed(0);
      setBgColor(reqTotalCell, getReqBackgroundColor(score));

      if (team === 'leia') {
        LEIA_TEAM_UNITS.forEach((unitId, idx) => {
          const relicCell = row.insertCell();
          relicCell.classList.add('col-requirements');
          if (idx === LEIA_TEAM_UNITS.length - 1) {
            relicCell.classList.add('separator-right');
          }
          const unitInfo = player[`reqLeia-${unitId}-relic`];
          relicCell.textContent = unitInfo.display;
          setBgColor(relicCell, getReqUnitBGColor(unitInfo, unitId));
        });
      }
      else if (team === 'jabba') {
        JABBA_TEAM_UNITS.forEach(unitId => {
          const relicCell = row.insertCell();
          relicCell.classList.add('col-requirements');
          if (idx === JABBA_TEAM_UNITS.length - 1) {
            relicCell.classList.add('separator-right');
          }
          const unitInfo = player[`reqJabba-${unitId}-relic`];
          relicCell.textContent = unitInfo.display;
          setBgColor(relicCell, getReqUnitBGColor(unitInfo, unitId));
        });
      }
    });

    tbColumns.forEach((col, idx) => {
      const tbCell = row.insertCell();
      tbCell.classList.add('col-tb');
      if (idx === 0 || col.phase !== tbColumns[idx - 1].phase) {
        tbCell.classList.add('separator-left');
      }

      if (col.type === 'ship') {
        const unitInfo = getShipInfo(player, col.unitId);
        tbCell.textContent = unitInfo.display;
        if (unitInfo.rarity >= col.level) {
          tbCell.style.backgroundColor = '#7ACC7A'; // Green
        } else if (unitInfo.type > 1) {
          tbCell.style.backgroundColor = '#FF9999'; // Red
        }
      } else { // character
        const unitInfo = getPlayerUnitInfo(player, col.unitId);
        tbCell.textContent = unitInfo.display;
        if (unitInfo.type === 3 && unitInfo.level >= col.level) {
          tbCell.style.backgroundColor = '#7ACC7A'; // Green
        } else if (unitInfo.type > 1) {
          tbCell.style.backgroundColor = '#FF9999'; // Red
        }
      }
    });
    if (tbColumns.length > 0) {
      const lastTbCell = row.cells[row.cells.length - 1];
      lastTbCell.classList.add('separator-right');
    }
  });
}

export function renderTableHeaders(table, tbColumns) {
  const thead = table.querySelector('thead');
  const headerRow1 = thead.rows[0];
  const headerRow2 = thead.rows[1];

  // Clear and rebuild TB headers
  headerRow1.querySelectorAll('.col-tb').forEach(th => th.remove());
  headerRow2.querySelectorAll('.col-tb').forEach(th => th.remove());
  const tbGroupHeaderPlaceholder = headerRow1.querySelector('.col-tb-group');
  if (tbGroupHeaderPlaceholder) tbGroupHeaderPlaceholder.remove();

  if (tbColumns.length > 0) {
    const columnsByPhase = {};
    tbColumns.forEach(col => {
      if (!columnsByPhase[col.phase]) {
        columnsByPhase[col.phase] = [];
      }
      columnsByPhase[col.phase].push(col);
    });

    const sortedPhases = Object.keys(columnsByPhase).sort((a, b) => parseInt(a) - parseInt(b));

    sortedPhases.forEach((phase, index) => {
      const phaseColumns = columnsByPhase[phase];
      const tbGroupHeader = document.createElement('th');
      tbGroupHeader.colSpan = phaseColumns.length;
      tbGroupHeader.className = 'col-tb';
      tbGroupHeader.textContent = `TB Platoons - Phase ${phase}`;

      if (index === 0) {
        tbGroupHeader.classList.add('separator-left');
      }

      if (index === sortedPhases.length - 1) {
        tbGroupHeader.classList.add('separator-right');
      }
      headerRow1.appendChild(tbGroupHeader);
    });

    tbColumns.forEach((col, idx) => {
      const charHeader = document.createElement('th');
      charHeader.className = 'col-tb';
      charHeader.dataset.sort = `tb-${col.unitId}-${col.level}`;
      if (idx === 0 || col.phase !== tbColumns[idx - 1].phase) {
        charHeader.classList.add('separator-left');
      }
      charHeader.title = `${col.available} available / ${col.required} required`;
      const requirementText = col.type === 'ship' ? `${col.level}*` : `r${col.level}`;
      charHeader.innerHTML = `${col.displayName} ${requirementText}<br>(${col.available}/${col.required})`;
      headerRow2.appendChild(charHeader);
    });
  }
}

export function renderDebugTable(planetRounds, tbody, callbacks, shipBaseIds) {
  tbody.innerHTML = '';

  planetRounds.forEach(rowInfo => {
    const { planetName, round, stats, isLastActiveRound } = rowInfo;
    const row = tbody.insertRow();

    // Helper to add click handler
    const addClickHandler = (cell, callback) => {
      cell.style.cursor = 'pointer';
      cell.style.textDecoration = 'underline';
      cell.addEventListener('click', callback);
    };

  // Round
    row.insertCell().textContent = round;

    // Side
    row.insertCell().textContent = stats.alignment;

    // Index
    row.insertCell().textContent = stats.phase;

    // Planet
    const planetCell = row.insertCell();
    planetCell.textContent = planetName;
    addClickHandler(planetCell, () => callbacks.onPlanetClick(planetName, stats, round, shipBaseIds));

    // Relic
    row.insertCell().textContent = stats.relic;

    // Units
    const unitCountCell = row.insertCell();
    const unitsAssignedThisRound = stats.units.filter(u => u.assignedInRound === round).length;
    const unitsAssignedBeforeThisRound = stats.units.filter(u => u.assignedInRound !== null && u.assignedInRound < round).length;
    const requiredForThisRound = stats.units.length - unitsAssignedBeforeThisRound;
    unitCountCell.textContent = `${unitsAssignedThisRound}/${requiredForThisRound}`;
    addClickHandler(unitCountCell, () => callbacks.onUnitCountClick(planetName, stats, round, shipBaseIds));

    // Missing
    const missingCell = row.insertCell();
    const missingCount = (isLastActiveRound && stats.missingCount > 0) ? stats.missingCount : '-';
    missingCell.textContent = missingCount;
    if (isLastActiveRound && stats.missingCount > 0) {
      missingCell.style.color = 'red';
      addClickHandler(missingCell, () => callbacks.onMissingClick(planetName, stats, stats.missingCount, shipBaseIds));
    }

    // Candidates
    const candidateCell = row.insertCell();
    const candidateCount = (isLastActiveRound && stats.candidateCount > 0) ? stats.candidateCount : '-';
    candidateCell.textContent = candidateCount;
    if (isLastActiveRound && stats.candidateCount > 0) {
      candidateCell.style.color = 'orange';
      addClickHandler(candidateCell, () => callbacks.onCandidateClick(planetName, stats));
    }

    // Players
    const playersCell = row.insertCell();
    const assignedPlayers = new Set(
      stats.units
        .filter(u => u.assignedInRound === round && u.assignedPlayerName)
        .map(u => u.assignedPlayerName)
    );
    playersCell.textContent = assignedPlayers.size > 0 ? assignedPlayers.size : '-';
    if (assignedPlayers.size > 0) {
      addClickHandler(playersCell, () => callbacks.onPlayersClick(planetName, stats, round));
    }
  });
}

export function renderDebugTableTotals(planetStats, callbacks) {
  // callbacks: { onTotalUnitsClick, onTotalMissingClick, onTotalCandidatesClick }
  let totalUnits = 0;
  let totalMissing = 0;
  let totalCandidates = 0;

  const planetsByRound = {};
  for (let i = 1; i <= 6; i++) {
    planetsByRound[i] = [];
  }

  for (const planetName in planetStats) {
    const planet = planetStats[planetName];
    totalUnits += planet.units.length;
    totalMissing += planet.missingCount;
    totalCandidates += planet.candidateCount;
    planet.rounds.forEach(round => {
      planetsByRound[round].push(planetStats[planetName]);
    });
  }

  const totalUnitsCell = document.getElementById('total-units');
  const totalMissingCell = document.getElementById('total-missing');
  const totalCandidatesCell = document.getElementById('total-candidates');

  if (totalUnitsCell) {
    totalUnitsCell.textContent = totalUnits;
    totalUnitsCell.onclick = () => callbacks.onTotalUnitsClick(planetsByRound);
  }
  if (totalMissingCell) {
    totalMissingCell.textContent = totalMissing;
    totalMissingCell.onclick = () => callbacks.onTotalMissingClick(planetsByRound);
  }
  if (totalCandidatesCell) {
    totalCandidatesCell.textContent = totalCandidates;
    totalCandidatesCell.onclick = () => callbacks.onTotalCandidatesClick(planetsByRound);
  }
}
