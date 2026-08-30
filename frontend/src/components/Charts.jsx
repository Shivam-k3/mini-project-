import { Pie, Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale,
  LinearScale, PointElement, LineElement, BarElement, Filler,
} from 'chart.js';
import { formatBreakdownKey } from '../utils/modeLabels';

ChartJS.register(
  ArcElement, Tooltip, Legend, CategoryScale,
  LinearScale, PointElement, LineElement, BarElement, Filler
);

const COLORS = ['#10b981', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4'];

export function EmissionPieChart({ breakdown }) {
  const labels = Object.keys(breakdown || {}).map(formatBreakdownKey);
  const data = Object.values(breakdown || {});

  return (
    <Pie
      data={{
        labels,
        datasets: [{
          data,
          backgroundColor: COLORS.slice(0, labels.length),
          borderWidth: 0,
          hoverOffset: 8,
        }],
      }}
      options={{
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true } },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ${ctx.parsed} kg CO₂`,
            },
          },
        },
      }}
    />
  );
}

export function TrendLineChart({ trend }) {
  const labels = (trend || []).map((t) =>
    new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  );
  const values = (trend || []).map((t) => t.total);

  return (
    <Line
      data={{
        labels,
        datasets: [{
          label: 'CO₂ Emissions (kg)',
          data: values,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
        }],
      }}
      options={{
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
          x: { grid: { display: false } },
        },
      }}
    />
  );
}

export function ComparisonBarChart({ comparison }) {
  if (!comparison) return null;
  const { categories, baseline, scenario } = comparison;
  const labels = categories.map((c) => c.charAt(0).toUpperCase() + c.slice(1));

  return (
    <Bar
      data={{
        labels,
        datasets: [
          {
            label: 'Baseline',
            data: baseline,
            backgroundColor: 'rgba(239, 68, 68, 0.7)',
            borderRadius: 6,
          },
          {
            label: 'Scenario',
            data: scenario,
            backgroundColor: 'rgba(16, 185, 129, 0.7)',
            borderRadius: 6,
          },
        ],
      }}
      options={{
        responsive: true,
        plugins: { legend: { position: 'top' } },
        scales: {
          y: { beginAtZero: true },
          x: { grid: { display: false } },
        },
      }}
    />
  );
}

export function ShapBarChart({ contributions }) {
  const sorted = Object.entries(contributions || {}).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(([k]) => k.charAt(0).toUpperCase() + k.slice(1));
  const values = sorted.map(([, v]) => v);

  return (
    <Bar
      data={{
        labels,
        datasets: [{
          label: 'Contribution (%)',
          data: values,
          backgroundColor: COLORS.slice(0, labels.length),
          borderRadius: 8,
        }],
      }}
      options={{
        indexAxis: 'y',
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { max: 100, ticks: { callback: (v) => `${v}%` } },
        },
      }}
    />
  );
}
