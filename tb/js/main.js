import { AppState } from './state.js';
import { processSingleData, processDiffData, sortAndRender } from './dataProcessor.js';
import { setupPhaseCheckboxes } from './renderer.js';

async function loadDefaultData() {
    try {
        const defaultFilePath = './default_data.json';
        const response = await fetch(defaultFilePath);
        if (response.ok) {
            const data = await response.json();
            AppState.currentData = data;
            onDataLoaded();
        } else {
            console.log("No default data file found or failed to load.");
        }
    } catch (error) {
        console.error("Error loading default data:", error);
    }
}

function clearDashboard() {
    document.getElementById('dashboard').innerHTML = '';
    document.querySelector('h1').textContent = 'Territory Battle Status';
    document.title = 'TB Status Dashboard';
    AppState.playerData = [];
    AppState.guildActivePhases = new Set();
    AppState.visiblePhases = new Set();
    AppState.guildName = '';
    AppState.guildGalacticPower = 0;
    AppState.isDiffMode = false;
    setupPhaseCheckboxes();
}

function onDataLoaded() {
    if (AppState.currentData && AppState.baselineData) {
        processDiffData(AppState.currentData, AppState.baselineData);
    } else if (AppState.currentData) {
        processSingleData(AppState.currentData);
    } else if (AppState.baselineData) {
        processSingleData(AppState.baselineData);
    } else {
        clearDashboard();
    }
}

function handleFileSelect(file, type) {
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (type === 'current') {
                    AppState.currentData = data;
                    document.getElementById('clear-current-button').style.display = 'inline-block';
                } else {
                    AppState.baselineData = data;
                    document.getElementById('clear-baseline-button').style.display = 'inline-block';
                }
                onDataLoaded();
            } catch (error) {
                alert('Error parsing JSON file.');
                console.error(error);
            }
        };
        reader.readAsText(file);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadDefaultData();
    document.getElementById('show-totals-checkbox').addEventListener('change', (event) => {
        AppState.showTotals = event.target.checked;
        sortAndRender();
    });
    document.getElementById('show-gp-checkbox').addEventListener('change', (event) => {
        AppState.showGP = event.target.checked;
        sortAndRender();
    });
    document.getElementById('show-units-checkbox').addEventListener('change', (event) => {
        AppState.showUnits = event.target.checked;
        sortAndRender();
    });
    document.getElementById('show-score-checkbox').addEventListener('change', (event) => {
        AppState.showScore = event.target.checked;
        sortAndRender();
    });
    document.getElementById('show-missions-score-checkbox').addEventListener('change', (event) => {
        AppState.showMissionsScore = event.target.checked;
        sortAndRender();
    });
    document.getElementById('show-deployed-checkbox').addEventListener('change', (event) => {
        AppState.showDeployed = event.target.checked;
        sortAndRender();
    });
    document.getElementById('show-special-missions-checkbox').addEventListener('change', (event) => {
        AppState.showSpecialMissions = event.target.checked;
        sortAndRender();
    });
    document.getElementById('show-waves-checkbox').addEventListener('change', (event) => {
        AppState.showWaves = event.target.checked;
        sortAndRender();
    });
    document.getElementById('show-undeployed-checkbox').addEventListener('change', (event) => {
        AppState.showUndeployed = event.target.checked;
        sortAndRender();
    });

    document.getElementById('current-file-input').addEventListener('change', (event) => {
        handleFileSelect(event.target.files[0], 'current');
    });
    document.getElementById('baseline-file-input').addEventListener('change', (event) => {
        handleFileSelect(event.target.files[0], 'baseline');
    });

    document.getElementById('clear-current-button').addEventListener('click', () => {
        AppState.currentData = null;
        const fileInput = document.getElementById('current-file-input');
        fileInput.value = '';
        document.getElementById('clear-current-button').style.display = 'none';
        onDataLoaded();
    });

    document.getElementById('clear-baseline-button').addEventListener('click', () => {
        AppState.baselineData = null;
        const fileInput = document.getElementById('baseline-file-input');
        fileInput.value = '';
        document.getElementById('clear-baseline-button').style.display = 'none';
        onDataLoaded();
    });

    const modal = document.getElementById('cell-info-modal');
    const closeBtn = modal.querySelector('.close');
    closeBtn.onclick = function () {
        modal.style.display = "none";
    }
    window.onclick = function (event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }
});

export { clearDashboard, onDataLoaded };
