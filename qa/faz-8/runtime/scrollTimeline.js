"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCROLL_SCENE_SLOPES = exports.SCROLL_MAPPING = exports.SCROLL_TIMELINE = exports.SCENE_CRITICAL_TIMES_SECONDS = exports.SCENE_MILESTONES_SECONDS = exports.SCROLL_HEIGHT_VH = exports.CINEMATIC_DURATION_SECONDS = void 0;
exports.findScrollSegment = findScrollSegment;
exports.mapScrollToCinematic = mapScrollToCinematic;
exports.getScrollTimelineSample = getScrollTimelineSample;
exports.getScrollProgressForChapter = getScrollProgressForChapter;
exports.getChapterViewportHeight = getChapterViewportHeight;
exports.CINEMATIC_DURATION_SECONDS = 11;
exports.SCROLL_HEIGHT_VH = 700;
exports.SCENE_MILESTONES_SECONDS = {
    heroStart: 0.00,
    awakening: 1.54,
    fragmentation: 3.08,
    coreReveal: 5.50,
    recall: 6.93,
    reassembly: 7.92,
    sealing: 10.34,
    final: 11.00
};
exports.SCENE_CRITICAL_TIMES_SECONDS = [
    exports.SCENE_MILESTONES_SECONDS.heroStart,
    exports.SCENE_MILESTONES_SECONDS.awakening,
    exports.SCENE_MILESTONES_SECONDS.fragmentation,
    exports.SCENE_MILESTONES_SECONDS.coreReveal,
    exports.SCENE_MILESTONES_SECONDS.recall,
    exports.SCENE_MILESTONES_SECONDS.reassembly,
    exports.SCENE_MILESTONES_SECONDS.sealing,
    exports.SCENE_MILESTONES_SECONDS.final
];
const clamp01 = (value) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const toSceneProgress = (seconds) => clamp01(seconds / exports.CINEMATIC_DURATION_SECONDS);
exports.SCROLL_TIMELINE = [
    {
        id: "hero",
        scrollStart: 0.00,
        scrollEnd: 0.15,
        sceneStartSeconds: exports.SCENE_MILESTONES_SECONDS.heroStart,
        sceneEndSeconds: exports.SCENE_MILESTONES_SECONDS.awakening,
        sceneStart: toSceneProgress(exports.SCENE_MILESTONES_SECONDS.heroStart),
        sceneEnd: toSceneProgress(exports.SCENE_MILESTONES_SECONDS.awakening)
    },
    {
        id: "unlock",
        scrollStart: 0.15,
        scrollEnd: 0.32,
        sceneStartSeconds: exports.SCENE_MILESTONES_SECONDS.awakening,
        sceneEndSeconds: exports.SCENE_MILESTONES_SECONDS.fragmentation,
        sceneStart: toSceneProgress(exports.SCENE_MILESTONES_SECONDS.awakening),
        sceneEnd: toSceneProgress(exports.SCENE_MILESTONES_SECONDS.fragmentation)
    },
    {
        id: "fragment",
        scrollStart: 0.32,
        scrollEnd: 0.50,
        sceneStartSeconds: exports.SCENE_MILESTONES_SECONDS.fragmentation,
        sceneEndSeconds: exports.SCENE_MILESTONES_SECONDS.coreReveal,
        sceneStart: toSceneProgress(exports.SCENE_MILESTONES_SECONDS.fragmentation),
        sceneEnd: toSceneProgress(exports.SCENE_MILESTONES_SECONDS.coreReveal)
    },
    {
        id: "core",
        scrollStart: 0.50,
        scrollEnd: 0.64,
        sceneStartSeconds: exports.SCENE_MILESTONES_SECONDS.coreReveal,
        sceneEndSeconds: exports.SCENE_MILESTONES_SECONDS.recall,
        sceneStart: toSceneProgress(exports.SCENE_MILESTONES_SECONDS.coreReveal),
        sceneEnd: toSceneProgress(exports.SCENE_MILESTONES_SECONDS.recall)
    },
    {
        id: "turn",
        scrollStart: 0.64,
        scrollEnd: 0.76,
        sceneStartSeconds: exports.SCENE_MILESTONES_SECONDS.recall,
        sceneEndSeconds: exports.SCENE_MILESTONES_SECONDS.reassembly,
        sceneStart: toSceneProgress(exports.SCENE_MILESTONES_SECONDS.recall),
        sceneEnd: toSceneProgress(exports.SCENE_MILESTONES_SECONDS.reassembly)
    },
    {
        id: "reassembly",
        scrollStart: 0.76,
        scrollEnd: 0.94,
        sceneStartSeconds: exports.SCENE_MILESTONES_SECONDS.reassembly,
        sceneEndSeconds: exports.SCENE_MILESTONES_SECONDS.sealing,
        sceneStart: toSceneProgress(exports.SCENE_MILESTONES_SECONDS.reassembly),
        sceneEnd: toSceneProgress(exports.SCENE_MILESTONES_SECONDS.sealing)
    },
    {
        id: "final",
        scrollStart: 0.94,
        scrollEnd: 1.00,
        sceneStartSeconds: exports.SCENE_MILESTONES_SECONDS.sealing,
        sceneEndSeconds: exports.SCENE_MILESTONES_SECONDS.final,
        sceneStart: toSceneProgress(exports.SCENE_MILESTONES_SECONDS.sealing),
        sceneEnd: toSceneProgress(exports.SCENE_MILESTONES_SECONDS.final)
    }
];
function findScrollSegment(progress) {
    const p = clamp01(progress);
    for (let index = 0; index < exports.SCROLL_TIMELINE.length; index += 1) {
        const segment = exports.SCROLL_TIMELINE[index];
        if (p >= segment.scrollStart && (p < segment.scrollEnd || index === exports.SCROLL_TIMELINE.length - 1)) {
            return { segment, index };
        }
    }
    return { segment: exports.SCROLL_TIMELINE[exports.SCROLL_TIMELINE.length - 1], index: exports.SCROLL_TIMELINE.length - 1 };
}
exports.SCROLL_MAPPING = "monotone-cubic-hermite";
const SCROLL_KNOTS = [exports.SCROLL_TIMELINE[0].scrollStart, ...exports.SCROLL_TIMELINE.map((segment) => segment.scrollEnd)];
const SCENE_KNOTS = [exports.SCROLL_TIMELINE[0].sceneStart, ...exports.SCROLL_TIMELINE.map((segment) => segment.sceneEnd)];
function buildMonotoneSlopes(xs, ys) {
    const count = xs.length;
    const delta = new Array(count - 1);
    const slopes = new Array(count);
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
exports.SCROLL_SCENE_SLOPES = buildMonotoneSlopes(SCROLL_KNOTS, SCENE_KNOTS);
function mapScrollToCinematic(progress) {
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
    return (h00 * segment.sceneStart +
        h10 * width * exports.SCROLL_SCENE_SLOPES[index] +
        h01 * segment.sceneEnd +
        h11 * width * exports.SCROLL_SCENE_SLOPES[index + 1]);
}
function getScrollTimelineSample(progress) {
    const p = clamp01(progress);
    const { segment, index } = findScrollSegment(p);
    const span = Math.max(1e-9, segment.scrollEnd - segment.scrollStart);
    const chapterProgress = clamp01((p - segment.scrollStart) / span);
    const cinematicProgress = mapScrollToCinematic(p);
    return {
        rawScrollProgress: p,
        cinematicProgress,
        sceneTime: cinematicProgress * exports.CINEMATIC_DURATION_SECONDS,
        chapterId: segment.id,
        chapterIndex: index,
        chapterProgress
    };
}
function getScrollProgressForChapter(id) {
    const segment = exports.SCROLL_TIMELINE.find((item) => item.id === id);
    return segment ? segment.scrollStart : 0;
}
function getChapterViewportHeight(id) {
    const segment = exports.SCROLL_TIMELINE.find((item) => item.id === id);
    if (!segment)
        return 100;
    return (segment.scrollEnd - segment.scrollStart) * exports.SCROLL_HEIGHT_VH;
}
