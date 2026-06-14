const palette = [
  '#e57373',
  '#81c784',
  '#64b5f6',
  '#ffd54f',
  '#ba68c8',
  '#4db6ac',
  '#f06292',
  '#7986cb',
  '#4fc3f7',
  '#ff8a65',
  '#a1887f',
  '#7f85c7',
];

export function colorForAttendee(name: string): string {
  let hash = 0;

  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return palette[Math.abs(hash) % palette.length];
}
