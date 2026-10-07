"use client";

import { getChapterViewportHeight, SCROLL_TIMELINE } from "@/lib/scrollTimeline";
import { NARRATIVE_COPY } from "@/lib/uiNarrative";

function TitleLines({ title }: { title: string }) {
  return (
    <>
      {title.split("\n").map((line, index) => (
        <span className="title-line" key={`${line}-${index}`}>
          {line}
        </span>
      ))}
    </>
  );
}

export function ScrollNarrative() {
  return (
    <div className="narrative-layer" aria-label="Sinematik anlatı">
      {SCROLL_TIMELINE.map((segment, index) => {
        const copy = NARRATIVE_COPY[segment.id];
        const start = Math.round(segment.scrollStart * 100);
        const end = Math.round(segment.scrollEnd * 100);
        return (
          <section
            id={segment.id}
            className={`narrative-section narrative-section--${copy.side}`}
            data-chapter
            data-chapter-id={segment.id}
            aria-labelledby={`${segment.id}-title`}
            style={{ minHeight: `${getChapterViewportHeight(segment.id)}dvh` }}
            key={segment.id}
          >
            <div className="narrative-copy">
              <div className="chapter-meta" aria-hidden="true">
                <span>{copy.number}</span>
                <i />
                <span>{String(start).padStart(2, "0")}–{String(end).padStart(2, "0")}</span>
              </div>

              <div className="chapter-kicker-row">
                <p className="chapter-eyebrow">{copy.eyebrow}</p>
                <span className="chapter-kicker">{copy.kicker}</span>
              </div>

              <h2 id={`${segment.id}-title`} aria-label={copy.title.replace("\n", " ")}>
                <TitleLines title={copy.title} />
              </h2>

              <div className="chapter-rule" aria-hidden="true"><i /></div>
              <p className="chapter-body">{copy.body}</p>
              <p className="chapter-accent">{copy.accent}</p>

              {index === 0 && (
                <div className="hero-actions">
                  <a className="primary-cta" href="#unlock" data-cinematic-link>
                    DENEYİME GİR <span aria-hidden="true">↓</span>
                  </a>
                  <a className="text-cta" href="#core" data-cinematic-link>
                    ÇEKİRDEĞE GİT <span aria-hidden="true">↗</span>
                  </a>
                </div>
              )}

              {index === SCROLL_TIMELINE.length - 1 && (
                <div className="final-actions">
                  <a className="primary-cta" href="#hero" data-cinematic-link>
                    BAŞA DÖN <span aria-hidden="true">↑</span>
                  </a>
                  <a className="text-cta" href="#fragment" data-cinematic-link>
                    PARÇALANMAYI İZLE <span aria-hidden="true">↗</span>
                  </a>
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
