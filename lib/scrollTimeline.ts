export const CINEMATIC_DURATION_SECONDS = 11;
export const SCROLL_HEIGHT_VH = 700;

export const SCENE_MILESTONES_SECONDS = {
  heroStart: 0.00,
  awakening: 1.54,
  fragmentation: 3.08,
  coreReveal: 5.50,
  recall: 6.93,
  reassembly: 7.92,
  sealing: 10.34,
  final: 11.00
} as const;

export const SCENE_CRITICAL_TIMES_SECONDS = [
  SCENE_MILESTONES_SECONDS.heroStart,
  SCENE_MILESTONES_SECONDS.awakening,
  SCENE_MILESTONES_SECONDS.fragmentation,
  SCENE_MILESTONES_SECONDS.coreReveal,
  SCENE_MILESTONES_SECONDS.recall,
  SCENE_MILESTONES_SECONDS.reassembly,
  SCENE_MILESTONES_SECONDS.sealing,
  SCENE_MILESTONES_SECONDS.final
] as const;

export type ScrollTimelineSegment = {
  id: string;
  scrollStart: number;
  scrollEnd: number;
  sceneStart: number;
  sceneEnd: number;
  sceneStartSeconds: number;
  sceneEndSeconds: number;
};

export type ScrollTimelineSample = {
  rawScrollProgress: number;
  cinematicProgress: number;
  sceneTime: number;
  chapterId: string;
  chapterIndex: number;
  chapterProgress: number;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const toSceneProgress = (seconds: number) => clamp01(seconds / CINEMATIC_DURATION_SECONDS);

export const SCROLL_TIMELINE: readonly ScrollTimelineSegment[] = [
  {
    id: "hero",
    scrollStart: 0.00,
    scrollEnd: 0.15,
    sceneStartSeconds: SCENE_MILESTONES_SECONDS.heroStart,
    sceneEndSeconds: SCENE_MILESTONES_SECONDS.awakening,
    sceneStart: toSceneProgress(SCENE_MILESTONES_SECONDS.heroStart),
    sceneEnd: toSceneProgress(SCENE_MILESTONES_SECONDS.awakening)
  },
  {
    id: "unlock",
    scrollStart: 0.15,
    scrollEnd: 0.32,
    sceneStartSeconds: SCENE_MILESTONES_SECONDS.awakening,
    sceneEndSeconds: SCENE_MILESTONES_SECONDS.fragmentation,
    sceneStart: toSceneProgress(SCENE_MILESTONES_SECONDS.awakening),
    sceneEnd: toSceneProgress(SCENE_MILESTONES_SECONDS.fragmentation)
  },
  {
    id: "fragment",
    scrollStart: 0.32,
    scrollEnd: 0.50,
    sceneStartSeconds: SCENE_MILESTONES_SECONDS.fragmentation,
    sceneEndSeconds: SCENE_MILESTONES_SECONDS.coreReveal,
    sceneStart: toSceneProgress(SCENE_MILESTONES_SECONDS.fragmentation),
    sceneEnd: toSceneProgress(SCENE_MILESTONES_SECONDS.coreReveal)
  },
  {
    id: "core",
    scrollStart: 0.50,
    scrollEnd: 0.64,
    sceneStartSeconds: SCENE_MILESTONES_SECONDS.coreReveal,
    sceneEndSeconds: SCENE_MILESTONES_SECONDS.recall,
    sceneStart: toSceneProgress(SCENE_MILESTONES_SECONDS.coreReveal),
    sceneEnd: toSceneProgress(SCENE_MILESTONES_SECONDS.recall)
  },
  {
    id: "turn",
    scrollStart: 0.64,
    scrollEnd: 0.76,
    sceneStartSeconds: SCENE_MILESTONES_SECONDS.recall,
    sceneEndSeconds: SCENE_MILESTONES_SECONDS.reassembly,
    sceneStart: toSceneProgress(SCENE_MILESTONES_SECONDS.recall),
    sceneEnd: toSceneProgress(SCENE_MILESTONES_SECONDS.reassembly)
  },
  {
    id: "reassembly",
    scrollStart: 0.76,
    scrollEnd: 0.94,
    sceneStartSeconds: SCENE_MILESTONES_SECONDS.reassembly,
    sceneEndSeconds: SCENE_MILESTONES_SECONDS.sealing,
    sceneStart: toSceneProgress(SCENE_MILESTONES_SECONDS.reassembly),
    sceneEnd: toSceneProgress(SCENE_MILESTONES_SECONDS.sealing)
  },
  {
    id: "final",
    scrollStart: 0.94,
    scrollEnd: 1.00,
    sceneStartSeconds: SCENE_MILESTONES_SECONDS.sealing,
    sceneEndSeconds: SCENE_MILESTONES_SECONDS.final,
    sceneStart: toSceneProgress(SCENE_MILESTONES_SECONDS.sealing),
    sceneEnd: toSceneProgress(SCENE_MILESTONES_SECONDS.final)
  }
] as const;

export function findScrollSegment(progress: number): { segment: ScrollTimelineSegment; index: number } {
  const p = clamp01(progress);
  for (let index = 0; index < SCROLL_TIMELINE.length; index += 1) {
    const segment = SCROLL_TIMELINE[index];
    if (p >= segment.scrollStart && (p < segment.scrollEnd || index === SCROLL_TIMELINE.length - 1)) {
      return { segment, index };
    }
  }
  return { segment: SCROLL_TIMELINE[SCROLL_TIMELINE.length - 1], index: SCROLL_TIMELINE.length - 1 };
}

export const SCROLL_MAPPING = "monotone-cubic-hermite" as const;

const SCROLL_KNOTS = [SCROLL_TIMELINE[0].scrollStart, ...SCROLL_TIMELINE.map((segment) => segment.scrollEnd)] as const;
const SCENE_KNOTS = [SCROLL_TIMELINE[0].sceneStart, ...SCROLL_TIMELINE.map((segment) => segment.sceneEnd)] as const;

function buildMonotoneSlopes(xs: readonly number[], ys: readonly number[]) {
  const count = xs.length;
  const delta = new Array<number>(count - 1);
  const slopes = new Array<number>(count);
  for (let index = 0; index < count - 1; index += 1) {
    const width = Math.max(1e-9, xs[index + 1] - xs[index]);
    delta[index] = (ys[index + 1] - ys[index]) / width;
  }
  slopes[0] = delta[0];
  slopes[count - 1] = delta[count - 2];
  for (let index = 1; index < count - 1; index += 1) {
    slopes[index] = (delta[index - 1] + delta[index]) * 0.5;
  }

  for (let index = 0; index < count - 1; index += 1) {
    const d = delta[index];
    if (Math.abs(d) < 1e-12) {
      slopes[index] = 0;
      slopes[index + 1] = 0;
      continue;
    }
    const alpha = slopes[index] / d;
    const beta = slopes[index + 1] / d;
    const magnitude = alpha * alpha + beta * beta;
    if (magnitude > 9) {
      const scale = 3 / Math.sqrt(magnitude);
      slopes[index] = scale * alpha * d;
      slopes[index + 1] = scale * beta * d;
    }
  }
  return slopes;
}

export const SCROLL_SCENE_SLOPES = buildMonotoneSlopes(SCROLL_KNOTS, SCENE_KNOTS) as readonly number[];

export function mapScrollToCinematic(progress: number) {
  const p = clamp01(progress);
  const { segment, index } = findScrollSegment(p);
  const width = Math.max(1e-9, segment.scrollEnd - segment.scrollStart);
  const t = clamp01((p - segment.scrollStart) / width);
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  return (
    h00 * segment.sceneStart +
    h10 * width * SCROLL_SCENE_SLOPES[index] +
    h01 * segment.sceneEnd +
    h11 * width * SCROLL_SCENE_SLOPES[index + 1]
  );
}

export function getScrollTimelineSample(progress: number): ScrollTimelineSample {
  const p = clamp01(progress);
  const { segment, index } = findScrollSegment(p);
  const span = Math.max(1e-9, segment.scrollEnd - segment.scrollStart);
  const chapterProgress = clamp01((p - segment.scrollStart) / span);
  const cinematicProgress = mapScrollToCinematic(p);
  return {
    rawScrollProgress: p,
    cinematicProgress,
    sceneTime: cinematicProgress * CINEMATIC_DURATION_SECONDS,
    chapterId: segment.id,
    chapterIndex: index,
    chapterProgress
  };
}

export function getScrollProgressForChapter(id: string) {
  const segment = SCROLL_TIMELINE.find((item) => item.id === id);
  return segment ? segment.scrollStart : 0;
}

export function getChapterViewportHeight(id: string) {
  const segment = SCROLL_TIMELINE.find((item) => item.id === id);
  if (!segment) return 100;
  return (segment.scrollEnd - segment.scrollStart) * SCROLL_HEIGHT_VH;
}
