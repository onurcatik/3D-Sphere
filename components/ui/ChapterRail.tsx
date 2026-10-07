"use client";

import { NARRATIVE_COPY, NARRATIVE_ORDER } from "@/lib/uiNarrative";

export function ChapterRail() {
  return (
    <aside className="chapter-rail" aria-label="Sinematik bölümler">
      <div className="chapter-rail__track" aria-hidden="true"><i /></div>
      <div className="chapter-rail__items">
        {NARRATIVE_ORDER.map((id, index) => {
          const item = NARRATIVE_COPY[id];
          return (
            <a
              key={id}
              href={`#${id}`}
              data-cinematic-link
              data-rail-chapter={id}
              className="chapter-rail__item"
              aria-label={`${index + 1}. bölüm: ${item.shortLabel}`}
            >
              <span className="chapter-rail__dot" aria-hidden="true" />
              <span className="chapter-rail__number">{item.number}</span>
              <span className="chapter-rail__label">{item.shortLabel}</span>
            </a>
          );
        })}
      </div>
    </aside>
  );
}
