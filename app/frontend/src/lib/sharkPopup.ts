import { getRiskLevel, getRiskDescription } from './sharkData';

export function createSharkPopupHTML(intensity: number): string {
  const { level, color } = getRiskLevel(intensity);
  const description = getRiskDescription(intensity);

  return `
    <div style="padding: 18px; min-width: 240px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
      <h3 style="margin: 0 0 16px 0; font-weight: 600; color: #1f2937; font-size: 16px; display: flex; align-items: center; gap: 8px;">
        🦈 Shark Activity
      </h3>
      <div style="border-left: 4px solid ${color}; padding-left: 14px; margin-bottom: 14px;">
        <p style="margin: 0 0 10px 0; font-size: 14px; color: #374151;">
          <strong style="color: #6b7280; font-weight: 500; display: block; margin-bottom: 4px;">Risk:</strong>
          <span style="color: ${color}; font-weight: 600; font-size: 16px;">${level}</span>
        </p>
        <p style="margin: 0; font-size: 14px; color: #374151;">
          <strong style="color: #6b7280; font-weight: 500; display: block; margin-bottom: 4px;">Activity:</strong>
          <span style="font-weight: 600; font-size: 16px;">${(intensity * 100).toFixed(0)}%</span>
        </p>
      </div>
      <p style="margin: 0; font-size: 12px; color: #9ca3af; font-style: italic;">
        ${description}
      </p>
    </div>
  `;
}
