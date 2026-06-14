import { colorForStage } from '../stageColors';

export interface RichNotification {
  id: string;
  title: string;
  body: string;
  tag: string;
  stage?: string;
  stageColor?: string;
  type?: string;
}

export function stageIconUrl(stage?: string, stageColor?: string): string {
  const color = stageColor || (stage ? colorForStage(stage) : undefined) || '#e07599';
  const safeColor = /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#e07599';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192">` +
    `<rect width="192" height="192" rx="44" fill="${safeColor}"/>` +
    `<text x="96" y="122" text-anchor="middle" fill="#ffffff" font-family="system-ui,sans-serif" font-size="80">♪</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function buildNotificationOptions(notification: RichNotification): NotificationOptions {
  return {
    body: notification.body,
    tag: notification.tag,
    icon: stageIconUrl(notification.stage, notification.stageColor),
    badge: './favicon.png',
    data: {
      id: notification.id,
      stage: notification.stage,
      type: notification.type,
    },
  };
}
