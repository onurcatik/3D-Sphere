#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import pathlib
import re
import shutil
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
QA = ROOT / "qa/faz-11"
RUNTIME = QA / "runtime"
QA.mkdir(parents=True, exist_ok=True)
RUNTIME.mkdir(parents=True, exist_ok=True)


def sha256(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


tsc = shutil.which("tsc")
node = shutil.which("node")
if not tsc or not node:
    raise SystemExit("Node.js/TypeScript compiler not found")

compile_cmd = [
    tsc,
    str(ROOT / "lib/scrollTimeline.ts"),
    str(ROOT / "lib/uiNarrative.ts"),
    "--target", "ES2020",
    "--module", "commonjs",
    "--skipLibCheck",
    "--outDir", str(RUNTIME),
]
compile_result = subprocess.run(compile_cmd, cwd=ROOT, text=True, capture_output=True)
(QA / "targeted_compile.txt").write_text((compile_result.stdout or "") + (compile_result.stderr or ""))
if compile_result.returncode != 0:
    raise SystemExit(compile_result.returncode)

node_program = r'''
const path = require('path');
const runtime = process.argv[1];
const t = require(path.join(runtime, 'scrollTimeline.js'));
const rows = [];
let spanSum = 0;
let heightSum = 0;
let maxStartProgressError = 0;
let maxStartTimeError = 0;
for (const segment of t.SCROLL_TIMELINE) {
  const span = segment.scrollEnd - segment.scrollStart;
  spanSum += span;
  const height = t.getChapterViewportHeight(segment.id);
  heightSum += height;
  const chapterProgress = t.getScrollProgressForChapter(segment.id);
  const sample = t.getScrollTimelineSample(segment.scrollStart);
  maxStartProgressError = Math.max(maxStartProgressError, Math.abs(chapterProgress - segment.scrollStart));
  maxStartTimeError = Math.max(maxStartTimeError, Math.abs(sample.sceneTime - segment.sceneStartSeconds));
  rows.push({
    id: segment.id,
    scrollStart: segment.scrollStart,
    scrollEnd: segment.scrollEnd,
    heightDvh: height,
    sceneStartSeconds: segment.sceneStartSeconds,
    sampledSceneTime: sample.sceneTime,
    sampledChapterId: sample.chapterId
  });
}
const dense = {monotone:true, finite:true, min:Infinity, max:-Infinity};
let prev = -Infinity;
for (let i=0;i<=10000;i++) {
  const p=i/10000;
  const s=t.getScrollTimelineSample(p);
  if (!Number.isFinite(s.sceneTime) || !Number.isFinite(s.cinematicProgress)) dense.finite=false;
  if (s.sceneTime + 1e-10 < prev) dense.monotone=false;
  prev=s.sceneTime;
  dense.min=Math.min(dense.min,s.sceneTime);
  dense.max=Math.max(dense.max,s.sceneTime);
}
process.stdout.write(JSON.stringify({
  duration:t.CINEMATIC_DURATION_SECONDS,
  scrollHeightVh:t.SCROLL_HEIGHT_VH,
  spanSum,
  heightSum,
  maxStartProgressError,
  maxStartTimeError,
  rows,
  dense
}, null, 2));
'''

sample_result = subprocess.run([node, "-e", node_program, str(RUNTIME)], cwd=ROOT, text=True, capture_output=True)
if sample_result.returncode != 0:
    (QA / "timeline_audit_error.txt").write_text((sample_result.stdout or "") + (sample_result.stderr or ""))
    raise SystemExit(sample_result.returncode)
(QA / "ui_scroll_timeline_audit.json").write_text(sample_result.stdout + "\n")
audit = json.loads(sample_result.stdout)

experience = (ROOT / "components/experience/CinematicExperience.tsx").read_text()
scroll_hook = (ROOT / "components/experience/useCinematicScroll.ts").read_text()
narrative = (ROOT / "components/ui/ScrollNarrative.tsx").read_text()
rail = (ROOT / "components/ui/ChapterRail.tsx").read_text()
hud = (ROOT / "components/ui/SceneHUD.tsx").read_text()
css = (ROOT / "app/globals.css").read_text()
all_tsx = "\n".join(path.read_text() for path in (ROOT / "components").rglob("*.tsx"))

header_match = re.search(r'<header className="site-header">(.*?)</header>', experience, re.S)
header = header_match.group(1) if header_match else ""

expected_desktop = "b791a252abb0ef542c113ebd3455b4fcea257cf4184cdf762b624be990b8035c"
expected_mobile = "f5ca166be26a826855cc40856dd66b318283e8f8e3cf91625f348078bab27e65"

checks = {
    "timelineSpanSumsToOne": abs(audit["spanSum"] - 1.0) < 1e-9,
    "chapterHeightsSumTo700dvh": abs(audit["heightSum"] - 700.0) < 1e-9 and audit["scrollHeightVh"] == 700,
    "chapterStartMappingExact": audit["maxStartProgressError"] < 1e-12 and audit["maxStartTimeError"] < 1e-9,
    "timelineDenseMonotoneFinite": audit["dense"]["monotone"] and audit["dense"]["finite"] and abs(audit["dense"]["max"] - 11) < 1e-9,
    "experienceHeightUsesTimelineConstant": "SCROLL_HEIGHT_VH" in experience and "--experience-scroll-height" in experience,
    "cssUsesExperienceHeightVariable": "min-height: var(--experience-scroll-height, 700dvh)" in css,
    "chapterNavigationUsesTimelineProgress": "getScrollProgressForChapter" in scroll_hook and "scrollToProgress(getScrollProgressForChapter(chapterId)" in scroll_hook,
    "chapterNavigationUsesMeasuredTriggerRange": "target = start + (end - start) * clamp01(progress)" in scroll_hook and "main.start" in scroll_hook and "main.end" in scroll_hook,
    "noElementScrollIntoViewNavigation": "scrollIntoView" not in scroll_hook,
    "singleLenisOwner": all_tsx.count("from \"lenis\"") == 0 and scroll_hook.count('from "lenis"') == 1,
    "noScrollSnapForcing": "scroll-snap" not in css.lower(),
    "currentChapterAriaState": 'setAttribute("aria-current", "step")' in scroll_hook and 'data-rail-chapter' in rail,
    "headerUsesChapterIndexNotRawMetrics": "data-scene-index" in header and "data-scene-percent" not in header and "data-scene-time" not in header,
    "rawMetricsIsolatedToDebugUi": "scene-debug" in experience and 'data-debug-ui="false"' in experience and 'get("debug") === "1"' in scroll_hook and '.experience-root[data-debug-ui="true"] .scene-debug' in css,
    "legacyPhaseBadgeRemoved": "phase-status" not in narrative and "FAZ 13" not in narrative,
    "finalNavigationIsUserControlled": "final-actions" in narrative and "BAŞA DÖN" in narrative and "PARÇALANMAYI İZLE" in narrative,
    "mobileSafeAreaPreserved": "env(safe-area-inset-top)" in css and "env(safe-area-inset-bottom)" in css and "env(safe-area-inset-left)" in css and "env(safe-area-inset-right)" in css,
    "touchTargetsAtLeast48Css": re.search(r'\.primary-cta,\s*\n\.text-cta \{\s*\n\s*min-height: 48px;', css) is not None,
    "readableNarrativeBody": "font-size: clamp(13.5px, .96vw, 15.5px)" in css and "font-size: 13px" in css,
    "skipLinkPresent": "skip-link" in experience and ".skip-link" in css,
    "hudNoRawTechnicalSeconds": "11.00 SEC" not in hud and "GLB / R3F" not in hud,
    "deepLinkMapsToTimeline": "initialHash" in scroll_hook and "scrollToChapter(initialHash, true)" in scroll_hook,
    "desktopGlbUnchanged": sha256(ROOT / "public/models/orb_v3_faz7_desktop.glb") == expected_desktop,
    "mobileGlbUnchanged": sha256(ROOT / "public/models/orb_v3_faz7_mobile.glb") == expected_mobile,
}

regressions = {}
# FAZ 10 validator already executes and records the required FAZ 1/2/5/6/7/8/9
# regression chain. Run it once here rather than recursively duplicating all prior work.
phase10_proc = subprocess.run(["python3", str(ROOT / "tools/validate_v3_faz10.py")], cwd=ROOT, text=True, capture_output=True)
(QA / "regression_faz10.log").write_text((phase10_proc.stdout or "") + (phase10_proc.stderr or ""))
phase10_report_path = ROOT / "qa/faz-10/validation_v3_faz10.json"
phase10_report = json.loads(phase10_report_path.read_text()) if phase10_report_path.exists() else {"checks": {}}
for phase in (1, 2, 5, 6, 7, 8, 9):
    ok = bool(phase10_report.get("checks", {}).get(f"faz{phase}Regression", False))
    regressions[f"faz{phase}"] = ok
    checks[f"faz{phase}Regression"] = ok
regressions["faz10"] = phase10_proc.returncode == 0 and bool(phase10_report.get("passed", False))
checks["faz10Regression"] = regressions["faz10"]

syntax_proc = subprocess.run([node, str(ROOT / "tools/check_ts_syntax.cjs")], cwd=ROOT, text=True, capture_output=True)
(QA / "ts_syntax.json").write_text(syntax_proc.stdout or "{}")
checks["tsTsxSyntax"] = syntax_proc.returncode == 0

report = {
    "phase": 11,
    "passed": all(checks.values()),
    "checks": checks,
    "summary": {
        "durationSeconds": audit["duration"],
        "scrollHeightDvh": audit["heightSum"],
        "chapterCount": len(audit["rows"]),
        "maxChapterStartProgressError": audit["maxStartProgressError"],
        "maxChapterStartSceneTimeError": audit["maxStartTimeError"],
        "denseSampleCount": 10001,
        "regressions": regressions,
    },
}
(QA / "validation_v3_faz11.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
raise SystemExit(0 if report["passed"] else 1)
