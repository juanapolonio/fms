export function PlaceholderPage({ title }) {
  return <section className="page-content"><div className="page-heading"><div><h1>{title}</h1><p>This module is reserved for the next implementation phase.</p></div></div><div className="placeholder-card"><i className="bi bi-cone-striped" /><h2>{title} placeholder</h2><p>The navigation and route are ready. Business workflows will be connected after the core ordering slice is verified.</p></div></section>;
}
