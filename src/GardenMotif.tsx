export type GardenMotifStage = 'seed' | 'sprout' | 'bloom';

/** Small, decorative botanical linework. It never replaces a status or control. */
export function GardenMotif({ stage = 'sprout', className = '' }: { stage?: GardenMotifStage; className?: string }) {
  return <svg viewBox="0 0 96 96" className={`garden-motif garden-motif-${stage} ${className}`} aria-hidden="true" focusable="false" fill="none">
    <ellipse cx="48" cy="80" rx="31" ry="7" className="garden-motif-ground" />
    <path d="M22 81c14-4 39-4 53 0M31 86h3m10 2h4m13-3h3" className="garden-motif-soil" />
    {stage === 'seed' ? <><ellipse cx="48" cy="69" rx="9" ry="12" transform="rotate(28 48 69)" className="garden-motif-seed" /><path d="M43 76c0-6 4-12 10-16" className="garden-motif-stem" /><circle cx="70" cy="48" r="2" className="garden-motif-pollen" /></> : <>
      <path d={stage === 'bloom' ? 'M48 79V33' : 'M48 79V41'} className="garden-motif-stem" />
      <path d="M48 65C29 65 24 55 26 44c14-1 25 6 22 21Z" className="garden-motif-leaf" />
      <path d="M48 54c0-16 10-24 23-23 1 13-7 24-23 23Z" className="garden-motif-leaf garden-motif-leaf-light" />
      <path d="m48 65-15-13m15 2 16-16" className="garden-motif-stem" />
      {stage === 'bloom' && <><path d="M48 28c-14-7-10-21-2-17 5-10 18-3 11 8 14 4 9 18-3 13-2 13-17 12-14 1-11 6-19-7-6-13" className="garden-motif-flower" /><circle cx="48" cy="25" r="5" className="garden-motif-flower-center" /></>}
      <circle cx="23" cy="31" r="2" className="garden-motif-pollen" /><circle cx="77" cy="62" r="1.5" className="garden-motif-pollen" />
    </>}
  </svg>;
}
