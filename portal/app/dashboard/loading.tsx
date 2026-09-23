import s from './dashboard.module.css';

// Instant skeleton between dashboard tabs (the sidebar pill has already moved optimistically).
export default function Loading() {
  return (
    <div aria-busy>
      <div className={`${s.skel} ${s.skelTitle}`} />
      <div className={s.tiles}>
        <div className={`${s.skel} ${s.skelTile}`} />
        <div className={`${s.skel} ${s.skelTile}`} />
        <div className={`${s.skel} ${s.skelTile}`} />
      </div>
      <div className={`${s.skel} ${s.skelBlock}`} />
    </div>
  );
}
