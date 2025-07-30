const dataPath = 'data/tw/hatori';
let dateString;
const MaxBattleScore = 22;
const MaxGroundBattleScore = 20;
const HourMilliseconds = 3600 * 1000;

let playerData = {};
let eventIds = {};
let duplicateEventsCount = 0;
let globalStartTime = null;
let globalEndTime = null;
let twResults = {};

async function getAvailableDates() {
    const logsPath = dataPath + "/logs/";
    try {
        const response = await fetch(logsPath);
        if (!response.ok) {
            throw new Error(`Could not list directories in ${logsPath}: ${response.status}`);
        }

        const dirHtml = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(dirHtml, 'text/html');
        const links = Array.from(doc.querySelectorAll('a'));
        return links
            .map(a => a.getAttribute('href'))
            .filter(href => href && href.match(/^\d{8}\/$/))
            .map(href => href.slice(0, 8));
    } catch (error) {
        console.error("Error fetching available dates:", error);
        document.getElementById('loading').style.display = 'none';
        document.getElementById('error').style.display = 'block';
        document.getElementById('error').textContent = `Failed to list available dates. Make sure the server provides a directory listing for ${logsPath}. Error: ${error.message}`;
        return [];
    }
}

function formatDateString(dateStr) {
    if (!dateStr || dateStr.length !== 8) return dateStr;
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return `${year}-${month}-${day}`;
}

async function handleDateChange(event) {
    dateString = event.target.value;
    await loadAllLogs();
}

function populateDateSelector(dates) {
    const selector = document.getElementById('dateSelector');
    if (!selector) return;

    selector.innerHTML = '';
    for (const date of dates) {
        const option = document.createElement('option');
        option.value = date;
        option.textContent = formatDateString(date);
        selector.appendChild(option);
    }

    selector.addEventListener('change', handleDateChange);
}

async function initializePage() {
    const dates = await getAvailableDates();
    if (dates.length > 0) {
        dates.sort().reverse(); // Sort to get the most recent first
        populateDateSelector(dates);

        dateString = dates[0]; // Select the most recent date by default
        document.getElementById('dateSelector').value = dateString;

        await loadAllLogs();
    } else {
        // Error is handled in getAvailableDates, but as a fallback:
        if (document.getElementById('error').style.display === 'none') {
            document.getElementById('loading').style.display = 'none';
            document.getElementById('error').style.display = 'block';
            document.getElementById('error').textContent = 'No TW log data found.';
        }
    }
}

function getDateString(path) {
    const parts = path.split('/');
    const dateStr = parts[parts.length - 2];
    if (!dateStr || dateStr.length !== 8) {
        return null;
    }
    return dateStr;
}

async function loadTwResults(dateStr) {
    if (!dateStr) return;
    const resultsPath = dataPath + `/tw_${dateStr}.json`;
    try {
        const response = await fetch(resultsPath);
        if (!response.ok) {
            console.warn(`Could not load TW results file: ${resultsPath}`);
            return;
        }
        const resultsData = await response.json();
        const attackStats = resultsData.currentStat.find(stat => stat.mapStatId === 'attack_stars');

        if (attackStats && attackStats.playerStat) {
            for (const playerStat of attackStats.playerStat) {
                if (playerStat.memberId && playerStat.score !== undefined) {
                    twResults[playerStat.memberId] = playerStat.score;
                }
            }
            console.log("Successfully loaded and processed TW results file.");
        } else {
            console.warn("Could not find 'attack_stars' stats in the results file.");
        }
    } catch (error) {
        console.error(`Error loading or parsing TW results file ${resultsPath}:`, error);
    }
}

function buildTitle(path) {
    const parts = path.split('/');
    const dateStr = parts[parts.length - 2]; // Get the '20250706' part
    if (!dateStr || dateStr.length !== 8) {
        return "Territory War Dashboard";
    }

    const year = dateStr.substring(0, 4);
    const month = parseInt(dateStr.substring(4, 6), 10) - 1; // Month is 0-indexed
    const day = dateStr.substring(6, 8);

    const date = new Date(year, month, day);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return `Territory War: ${date.toLocaleDateString('en-US', options)}`;
}

async function loadAllLogs() {
    resetData();

    const logsPath = dataPath + `/logs/${dateString}/`;

    try {
        const title = buildTitle(logsPath);
        document.title = title;
        document.querySelector('.header h1').textContent = title;

        await loadTwResults(dateString);

        const loadingText = document.getElementById('loadingText');
        loadingText.textContent = 'Fetching file list...';

        // Fetch the directory listing to get file names
        const response = await fetch(logsPath);
        if (!response.ok) {
            throw new Error(`Could not list files in ${logsPath}: ${response.status}`);
        }
        const dirHtml = await response.text();

        // Parse the HTML to find links to .json files
        const parser = new DOMParser();
        const doc = parser.parseFromString(dirHtml, 'text/html');
        const links = Array.from(doc.querySelectorAll('a'));
        const logFileNames = links
            .map(a => a.getAttribute('href'))
            .filter(href => href && href.endsWith('.json'))
            .map(href => href.split('/').pop()); // Get just the filename

        if (logFileNames.length === 0) {
            const errorMsg = `No .json files found in ${logsPath}. Make sure the server is configured to show directory listings.`;
            document.getElementById('loading').style.display = 'none';
            document.getElementById('error').style.display = 'block';
            document.getElementById('error').textContent = errorMsg;
            console.error(errorMsg);
            return;
        }

        const totalFiles = logFileNames.length;
        let fileIndex = 0;

        updateProgress(0, totalFiles, "Starting to load log files...");

        for (const fileName of logFileNames) {
            ++fileIndex;
            console.log("Loading file #" + fileIndex + ": " + fileName);
            try {
                const response = await fetch(logsPath + fileName);
                if (!response.ok) {
                    console.warn(`Could not load ${fileName}: ${response.status}`);
                    continue;
                }
                const data = await response.json();
                processLogData(data);

                updateProgress(fileIndex, totalFiles, `Loaded ${fileIndex}/${totalFiles} files`);
            } catch (error) {
                console.warn(`Error loading ${fileName}:`, error);
            }
        }

        updateProgress(totalFiles, totalFiles, "Processing data...");

        if (Object.keys(playerData).length === 0) {
            throw new Error("No log files could be loaded. Check browser console for details.");
        }

        displayData();

    } catch (error) {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('error').style.display = 'block';
        document.getElementById('error').textContent = `Error loading data: ${error.message}`;
    }
}

function resetData() {
    playerData = {};
    eventIds = {};
    duplicateEventsCount = 0;
    globalStartTime = null;
    globalEndTime = null;
    twResults = {};

    document.getElementById('stats').style.display = 'none';
    document.getElementById('activity-heatmap-container').style.display = 'none';
    document.getElementById('players').style.display = 'none';
    document.getElementById('error').style.display = 'none';
    document.getElementById('loading').style.display = 'block';
}

function updateProgress(loaded, total, message) {
    const percentage = Math.round((loaded / total) * 100);
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const loadingText = document.getElementById('loadingText');

    if (progressFill) progressFill.style.width = percentage + '%';
    if (progressText) progressText.textContent = `${percentage}% (${loaded}/${total})`;
    if (loadingText) loadingText.textContent = message;
}

function getScoreFromActivityLogMessage(msg) {
    if (!msg || !msg.param) {
        return null;
    }

    for (const param of msg.param) {
        if (!param.paramValue || param.paramValue.length < 1) {
            continue;
        }
        const score = parseInt(param.paramValue[0]);
        if (!isNaN(score)) {
            return score;
        }
    }

    return null;
}

function processLogData(data) {
    if (!data.event) return;

    for (const event of data.event) {
        const authorId = event.authorId;
        const authorName = event.authorName;
        const timestamp = parseInt(event.timestamp);

        // Update global time range
        if (!globalStartTime || timestamp < globalStartTime) {
            globalStartTime = timestamp;
        }
        if (!globalEndTime || timestamp > globalEndTime) {
            globalEndTime = timestamp;
        }

        // Check for duplicate events
        const eventKey = `${timestamp}-${authorId}`;
        const existingKey = eventIds[event.id];

        if (existingKey !== undefined) {
            if (eventKey !== existingKey) {
                console.error("Events with the same id have different timestamp or author_id!");
                continue;
            }
            duplicateEventsCount++;
            continue;
        }

        eventIds[event.id] = eventKey;

        // Initialize player data
        if (!playerData[authorId]) {
            playerData[authorId] = {
                name: authorName,
                events: [],
                attacks: [],  // Store attack pairs (SQUAD_LOCKED + outcome)
                scores: [],
                attackCount: 0,
                attempts: 0,
                wins: 0,
                losses: 0
            };
        }

        let eventInfo = {
            timestamp: timestamp,
            date: new Date(timestamp),
            score: 0,
            outcome: null,
            squadStatus: null,
            defenderLead: null,
            zoneId: null,
            isAttack: false
        };

        // Process event data
        for (const d of event.data || []) {
            const payload = d.payload;
            const zoneData = payload.zoneData;

            // Extract score
            if (!eventInfo.score && zoneData) {
                eventInfo.zoneId = zoneData.zoneId;

                const score = getScoreFromActivityLogMessage(
                    zoneData.activityLogMessage);
                if (!eventInfo.score && score) {
                    if (score <= MaxBattleScore) {
                        eventInfo.score = score;
                    }
                }

                /*if (!eventInfo.score) {
                    // Get score from scoreDelta
                    if (zoneData.scoreDelta) {
                        const score = parseInt(zoneData.scoreDelta);
                        if (!isNaN(score)) {
                            if (score <= MaxBattleScore) {
                                eventInfo.score = score;
                            }
                        }
                    }
                }*/
            }

            // Check squad status to determine outcome
            const squad = payload.warSquad;
            if (squad) {
                const squadStatus = squad.squadStatus;
                if (squadStatus === 'SQUAD_DEFEATED') {
                    eventInfo.outcome = 'win';
                    eventInfo.squadStatus = squadStatus;
                    eventInfo.isAttack = true;
                } else if (squadStatus === 'SQUAD_AVAILABLE') {
                    eventInfo.outcome = 'fail';
                    eventInfo.squadStatus = squadStatus;
                    eventInfo.isAttack = true;
                } else if (squadStatus === 'SQUAD_LOCKED') {
                    eventInfo.outcome = 'attacking';
                    eventInfo.squadStatus = squadStatus;
                    eventInfo.isAttack = true;
                }

                // Extract defender lead from squad data
                if (squad.squad && squad.squad.cell) {
                    for (const cell of squad.squad.cell) {
                        if ((cell.squadUnitType === "UNITTYPE_LEADER" || cell.squadUnitType === "UNITTYPE_COMMANDER") && cell.unitDefId) {
                            // Remove colon and everything after it, then format
                            let defenderName = cell.unitDefId.split(':')[0];
                            if (defenderName.startsWith("CAPITAL")) {
                                defenderName = defenderName.substring("CAPITAL".length);
                            }
                            // Convert to proper case (first letter uppercase, rest lowercase)
                            eventInfo.defenderLead = defenderName.charAt(0).toUpperCase() +
                                                   defenderName.slice(1).toLowerCase();
                            break; // Found the leader
                        }
                    }
                }
            }
        }

        playerData[authorId].events.push(eventInfo);

        if (eventInfo.score > 0) {
            playerData[authorId].scores.push(eventInfo.score);
        }

        // Count statistics
        if (eventInfo.isAttack) {
            switch (eventInfo.squadStatus) {
                case 'SQUAD_LOCKED':
                    playerData[authorId].attempts++;
                    break;
                case 'SQUAD_DEFEATED':
                    playerData[authorId].wins++;
                    break;
                case 'SQUAD_AVAILABLE':
                    playerData[authorId].losses++;
                    break;
            }
        }
    }
}

function displayData() {
    document.getElementById('loading').style.display = 'none';

    if (globalEndTime) {
        // TW attack phase lasts for 24 hours, so compute the start of it from the last event.
        // The last event timestamp can be slightly bigger than the end of TW, but can be smaller as well.
        // Therefore subtract 24 hours (and not 23) just in case.
        const endDate = new Date(globalEndTime);
        endDate.setMinutes(0, 0, 0);  // Round down to the hour
        globalStartTime = endDate.getTime() - 24 * HourMilliseconds;
    } else if (globalStartTime) {
        // Round global start time to the closest preceding hour
        const startDate = new Date(globalStartTime);
        startDate.setMinutes(0, 0, 0);  // Round down to the hour
        globalStartTime = startDate.getTime();
    }

    // Process attack pairs for each player
    for (const playerId of Object.keys(playerData)) {
        processPlayerAttacks(playerData[playerId]);
    }

    console.log(`Found and skipped ${duplicateEventsCount} duplicate events.`);

    // Calculate and display summary stats
    displayStats();

    // Display the activity heatmap
    displayActivityHeatmap();

    // Add total attack score from results to each player
    for (const [id, data] of Object.entries(playerData)) {
        if (twResults[id] !== undefined) {
            data.totalAttackScore = twResults[id];
        } else {
            data.totalAttackScore = null;
        }
    }

    // Sort players by total score
    const sortedPlayers = Object.entries(playerData)
        .map(([id, data]) => {
            const eventsScore = data.scores.reduce((sum, score) => sum + score, 0);
            const attackCount = data.attacks.length;

            return {
                id,
                ...data,
                eventsScore,
                attackCount
            };
        })
        .sort((a, b) => {
            const scoreA = a.totalAttackScore ?? a.eventsScore;
            const scoreB = b.totalAttackScore ?? b.eventsScore;
            return scoreB - scoreA;
        });

    const maxPlayerScore = Math.max(...sortedPlayers.map(p => p.totalAttackScore ?? p.eventsScore));

    const playersDiv = document.getElementById('players');
    playersDiv.innerHTML = '';

    for (let i = 0; i < sortedPlayers.length; i++) {
        const player = sortedPlayers[i];
        const rank = i + 1;
        const playerCard = createPlayerCard(player, maxPlayerScore, rank);
        playersDiv.appendChild(playerCard);
    }

    document.getElementById('players').style.display = 'grid';
    document.getElementById('stats').style.display = 'grid';
    document.getElementById('activity-heatmap-container').style.display = 'block';
}

function displayActivityHeatmap() {
    const heatmap = document.getElementById('activity-heatmap');
    const heatmapInfo = document.getElementById('heatmap-info');
    if (!heatmap || !heatmapInfo) return;

    const timelineDuration = globalEndTime - globalStartTime;
    const interval = 5 * 60 * 1000; // 5 minutes
    const numIntervals = Math.ceil(timelineDuration / interval);
    const activity = new Array(numIntervals).fill(0);

    // Populate activity array
    for (const player of Object.values(playerData)) {
        for (const attack of player.attacks) {
            const startInterval = Math.floor((attack.startTime - globalStartTime) / interval);
            const endInterval = Math.ceil((attack.endTime - globalStartTime) / interval);

            for (let i = startInterval; i < endInterval; i++) {
                if (i >= 0 && i < numIntervals) {
                    activity[i]++;
                }
            }
        }
    }

    const maxActivity = Math.max(...activity);
    if (maxActivity === 0) return; // No activity to display

    // Generate heatmap segments
    heatmap.innerHTML = '';
    for (let i = 0; i < numIntervals; i++) {
        const segment = document.createElement('div');
        segment.className = 'heatmap-segment';
        const intensity = activity[i] / maxActivity;
        segment.style.width = `${100 / numIntervals}%`;

        const segmentStartTime = new Date(globalStartTime + i * interval);
        const segmentEndTime = new Date(globalStartTime + (i + 1) * interval);
        const timeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
        const startTimeStr = segmentStartTime.toLocaleTimeString([], timeFormatOptions);
        const endTimeStr = segmentEndTime.toLocaleTimeString([], timeFormatOptions);

        segment.title = `[${startTimeStr} - ${endTimeStr}] Active players: ${activity[i]}`;

        if (activity[i] === 0) {
            segment.style.backgroundColor = 'black';
        } else {
            // Monochromatic blue scale: lightness indicates intensity
            const h = 240; // Hue for blue
            const s = 100; // Saturation
            const l = 25 + (intensity * 50); // Lightness from 25% (dark) to 75% (bright)
            segment.style.backgroundColor = `hsl(${h}, ${s}%, ${l}%)`;
        }

        heatmap.appendChild(segment);
    }

    // Add timeline info
    const startTime = new Date(globalStartTime);
    const endTime = new Date(globalEndTime);
    heatmapInfo.innerHTML = `
        <span class="timeline-start-time">${startTime.toLocaleString()}</span>
        <span class="timeline-end-time">${endTime.toLocaleString()}</span>
    `;
}

function processPlayerAttacks(playerData) {
    // Sort events by timestamp
    const sortedEvents = playerData.events.sort((a, b) => a.timestamp - b.timestamp);

    playerData.attacks = [];

    for (let i = 0; i < sortedEvents.length; i++) {
        const currentEvent = sortedEvents[i];

        // Look for SQUAD_LOCKED followed by outcome
        if (currentEvent.squadStatus === 'SQUAD_LOCKED') {
            const endEvent = i + 1 < sortedEvents.length ? sortedEvents[i + 1] : null;
            if (endEvent && (endEvent.squadStatus === 'SQUAD_DEFEATED' || endEvent.squadStatus === 'SQUAD_AVAILABLE')) {
                const attack = {
                    startTime: currentEvent.timestamp,
                    endTime: endEvent.timestamp,
                    startEvent: currentEvent,
                    endEvent: endEvent,
                    outcome: endEvent.outcome,
                    score: endEvent.score,
                    zoneId: endEvent.zoneId || currentEvent.zoneId,
                    defenderLead: endEvent.defenderLead || currentEvent.defenderLead
                };

                playerData.attacks.push(attack);
            }
            else {
                const attack = {
                    startTime: currentEvent.timestamp,
                    endTime: currentEvent.timestamp + 3*60*1000, // +3 min
                    startEvent: currentEvent,
                    endEvent: null,
                    outcome: null,
                    score: null,
                    zoneId: currentEvent.zoneId,
                    defenderLead: currentEvent.defenderLead
                };

                playerData.attacks.push(attack);

                const date = new Date(currentEvent.timestamp);
                console.log("Missing ending event for player ", playerData.name, " ", date.toLocaleString(), " timestamp=", currentEvent.timestamp);
            }
        }
    }
}

function displayStats() {
    const totalPlayers = Object.keys(playerData).length;
    const totalEvents = Object.values(playerData).reduce((sum, player) => sum + player.events.length, 0);
    const totalScore = Object.values(playerData).reduce((sum, player) =>
        sum + player.scores.reduce((pSum, score) => pSum + score, 0), 0
    );
    const avgScore = totalScore / totalPlayers;

    const statsDiv = document.getElementById('stats');
    statsDiv.innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${totalPlayers}</div>
            <div class="stat-label">Total Players</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${totalEvents}</div>
            <div class="stat-label">Total Events</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${totalScore}</div>
            <div class="stat-label">Total Score</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${Math.round(avgScore)}</div>
            <div class="stat-label">Avg Score/Player</div>
        </div>
    `;
}

function createPlayerCard(player, maxPlayerScore, rank) {
    const card = document.createElement('div');
    card.className = 'player-card';

    const playerScore = player.totalAttackScore ?? player.eventsScore;
    const scoreBarWidth = maxPlayerScore > 0 ? (playerScore / maxPlayerScore) * 100 : 0;

    const timeline = document.createElement('div');
    timeline.className = 'timeline';

    // Calculate timeline duration in milliseconds
    const timelineDuration = globalEndTime - globalStartTime;

    // Create segments for each attack
    for (const attack of player.attacks) {
        const segment = document.createElement('div');
        segment.className = 'timeline-segment';

        if (attack.outcome === 'win') {
            segment.classList.add('win');
        } else if (attack.outcome === 'fail') {
            segment.classList.add('fail');
        }

        // Calculate position and width as percentages
        const startPercent = ((attack.startTime - globalStartTime) / timelineDuration) * 100;
        const duration = attack.endTime - attack.startTime;
        const widthPercent = (duration / timelineDuration) * 100;

        segment.style.left = startPercent + '%';
        segment.style.width = Math.max(widthPercent, 0.5) + '%'; // Minimum width for visibility

        // Add click handler
        segment.onclick = () => showAttackModal(attack, player.name);

        timeline.appendChild(segment);
    }

    // Create timeline info
    const timelineInfo = document.createElement('div');
    timelineInfo.className = 'timeline-info';

    const startTime = new Date(globalStartTime);
    const endTime = new Date(globalEndTime);

    timelineInfo.innerHTML = `
        <span class="timeline-start-time">${startTime.toLocaleString()}</span>
        <span class="timeline-end-time">${endTime.toLocaleString()}</span>
    `;

    card.innerHTML = `
        <div class="player-header">
            <div class="player-rank">${rank}.</div>
            <div class="player-name">${player.name}</div>
            <div class="player-score">
                Wins: <span class="score-events">${player.wins}</span>/<span class="score-total">${player.attackCount}</span> | Score:
                <span class="score-events">${player.eventsScore}</span>/<span class="score-total">${player.totalAttackScore ?? '?'}</span>
            </div>
        </div>
        <div class="player-score-bar-container">
            <div class="player-score-bar-fill" style="width: ${scoreBarWidth}%;"></div>
        </div>
    `;

    card.insertBefore(timeline, card.lastChild);
    card.insertBefore(timelineInfo, card.lastChild);
    return card;
}

function showAttackModal(attack, playerName) {
    const modal = document.getElementById('eventModal');
    const modalInfo = document.getElementById('modalInfo');

    const outcomeClass = attack.outcome === 'win' ? 'outcome-win' :
                        attack.outcome === 'fail' ? 'outcome-fail' : 'outcome-unknown';
    const outcomeText = attack.outcome === 'win' ? 'Victory' :
                        attack.outcome === 'fail' ? 'Defeat' : 'Unknown';

    const startTime = new Date(attack.startTime);
    const endTime = new Date(attack.endTime);
    const duration = Math.round((attack.endTime - attack.startTime) / 1000); // Duration in seconds

    modalInfo.innerHTML = `
        <div class="info-row">
            <span class="info-label">Player:</span>
            <span class="info-value">${playerName}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Outcome:</span>
            <span class="info-value ${outcomeClass}">${outcomeText}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Score:</span>
            <span class="info-value">${attack.score===null?'?':attack.score}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Start Time:</span>
            <span class="info-value">${startTime.toLocaleString()}</span>
        </div>
        <div class="info-row">
            <span class="info-label">End Time:</span>
            <span class="info-value">${endTime.toLocaleString()}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Duration:</span>
            <span class="info-value">${duration} seconds</span>
        </div>
        <div class="info-row">
            <span class="info-label">Zone:</span>
            <span class="info-value">${attack.zoneId || 'Unknown'}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Defender Lead:</span>
            <span class="info-value">${attack.defenderLead || 'Unknown'}</span>
        </div>
    `;

    modal.style.display = 'block';
}

// Modal functionality
const modal = document.getElementById('eventModal');
const closeBtn = document.getElementsByClassName('close')[0];

closeBtn.onclick = function() {
    modal.style.display = 'none';
}

window.onclick = function(event) {
    if (event.target == modal) {
        modal.style.display = 'none';
    }
}

// Load data when page loads
window.addEventListener('load', initializePage);
