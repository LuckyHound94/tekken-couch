export interface SideRead {
  time: number;
  left: string | null;
  right: string | null;
}

export interface SideSegment {
  start: number;
  end: number;
  left: string | null;
  right: string | null;
}

export interface SettledSides {
  segments: SideSegment[];
}

function conflicts(a: SideSegment, b: SideRead): boolean {
  return (a.left != null && b.left != null && a.left !== b.left) || (a.right != null && b.right != null && a.right !== b.right);
}

export function settleSides(reads: SideRead[]): SettledSides {
  const ordered = [...reads].sort((a, b) => a.time - b.time);
  const runs: Array<SideSegment & { count: number }> = [];
  for (const read of ordered) {
    if (read.left == null && read.right == null) continue;
    const last = runs[runs.length - 1];
    if (last && !conflicts(last, read)) {
      last.left = last.left ?? read.left;
      last.right = last.right ?? read.right;
      last.end = read.time;
      last.count += 1;
    } else {
      runs.push({ start: read.time, end: read.time, left: read.left, right: read.right, count: 1 });
    }
  }
  const longer = runs.some((run) => run.count > 1);
  const kept = runs.filter((run) => run.count > 1 || !longer);
  return {
    segments: kept.map(({ start, end, left, right }) => ({ start, end, left, right })),
  };
}

export function sampleTimes(duration: number): number[] {
  if (!Number.isFinite(duration) || duration <= 0) return [0];
  const count = Math.min(12, Math.max(4, Math.round(duration / 6)));
  const inset = Math.min(0.4, duration * 0.04);
  const start = inset;
  const end = Math.max(start, duration - inset);
  if (count === 1 || end === start) return [(start + end) / 2];
  const times: number[] = [];
  for (let i = 0; i < count; i++) times.push(start + ((end - start) * i) / (count - 1));
  return times;
}

export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}
