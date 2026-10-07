"use client";

export function SceneHUD() {
  return (
    <div className="scene-hud" aria-hidden="true">
      <div className="hud-corner hud-corner--tl"><span /></div>
      <div className="hud-corner hud-corner--tr"><span /></div>
      <div className="hud-corner hud-corner--bl"><span /></div>
      <div className="hud-corner hud-corner--br"><span /></div>

      <div className="hud-coordinate hud-coordinate--left">
        <span>OBJECT / ORIVION</span>
        <i />
        <span>LIVE FORM</span>
      </div>
      <div className="hud-coordinate hud-coordinate--right">
        <span>SCROLL / CONTROL</span>
        <i />
        <span>REVERSIBLE</span>
      </div>

      <div className="hud-centerline"><i /></div>
    </div>
  );
}
