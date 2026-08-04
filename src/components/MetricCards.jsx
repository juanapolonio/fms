const metricIcons = ['bi-grid', 'bi-check-circle-fill', 'bi-pause-circle-fill', 'bi-tag-fill', 'bi-graph-up-arrow', 'bi-wallet2'];

export function MetricCards({ metrics }) {
  return <div className="metric-grid">{metrics.map(([value, label], index) => <div className="metric-card" key={label}><div className={`metric-icon metric-${index % 5}`}><i className={`bi ${metricIcons[index % metricIcons.length]}`} /></div><div><strong>{value}</strong><span>{label}</span><small>Current period</small></div></div>)}</div>;
}
