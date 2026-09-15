// Temporary scaffold marker — every screen replaces this with its real content.
// The four mandatory states (loading skeleton / empty / error-in-card / forbidden) are the
// owning agent's job; this only proves the route, the shell and the lazy boundary work.
export function PagePlaceholder({ screen, title }: { screen: string; title: string }) {
  return (
    <section className="rounded-lg border border-border bg-bg-surface p-card">
      <h2 className="text-card-title text-text">{title}</h2>
      <p className="text-card-sub text-text-muted">{screen} · not implemented yet</p>
    </section>
  );
}
