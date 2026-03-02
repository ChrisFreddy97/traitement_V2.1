// dashboards/technical/HourlyChart.js
import { database } from '../../arduinoCore.js';

export function renderHourlyChart() {
    const container = document.getElementById('hourlyChartCard');
    if (!container) return;
    
    container.innerHTML = `
        <h3 class="card-title">⏱️ ÉVOLUTION HORAIRE (DERNIÈRES 24H)</h3>
        <div style="height: 250px; width: 100%; background: #0f151f; border-radius: 8px; padding: 15px;">
            <canvas id="hourlyTensionChart" style="width:100%; height:100%;"></canvas>
        </div>
    `;
    
    setTimeout(() => createHourlyTensionChart(), 100);
}

function createHourlyTensionChart() {
    const ctx = document.getElementById('hourlyTensionChart');
    if (!ctx) return;
    
    if (window.hourlyChart) window.hourlyChart.destroy();
    
    const tensionTable = database.tables.find(t => t.type === 'T');
    if (!tensionTable) return;
    
    const last24 = tensionTable.data.slice(-24);
    const hours = last24.map(row => {
        const time = row.split(';')[1].split(' ')[1];
        return time.substring(0, 5);
    });
    const tensions = last24.map(row => parseFloat(row.split(';')[4])); // Tension max
    
    // Ajouter la moyenne mobile
    const moyenneMobile = tensions.map((_, i, arr) => {
        const start = Math.max(0, i-2);
        const end = Math.min(arr.length, i+3);
        const slice = arr.slice(start, end);
        return slice.reduce((s, v) => s + v, 0) / slice.length;
    });
    
    window.hourlyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: hours,
            datasets: [
                {
                    label: 'Tension (V)',
                    data: tensions,
                    borderColor: '#ff9800',
                    backgroundColor: 'rgba(255, 152, 0, 0.1)',
                    tension: 0.3,
                    fill: true,
                    pointRadius: 3,
                    pointHoverRadius: 5
                },
                {
                    label: 'Moyenne mobile (3h)',
                    data: moyenneMobile,
                    borderColor: '#4CAF50',
                    borderDash: [5, 5],
                    tension: 0.3,
                    fill: false,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#aaa' }
                },
                tooltip: {
                    backgroundColor: '#1e2a3a',
                    titleColor: '#ff9800',
                    bodyColor: '#aaa',
                    borderColor: '#d4a373',
                    borderWidth: 1
                }
            },
            scales: {
                y: {
                    grid: { color: '#2a3a4a' },
                    ticks: { color: '#aaa' },
                    title: {
                        display: true,
                        text: 'Tension (V)',
                        color: '#aaa'
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#aaa', maxRotation: 45 }
                }
            }
        }
    });
}