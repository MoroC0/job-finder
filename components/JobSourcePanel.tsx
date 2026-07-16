'use client';

import { useState } from 'react';

const SOURCE_OPTIONS = [
  { label: 'Mock', value: 'mock' },
  { label: 'Indeed (sample)', value: 'indeed' },
  { label: 'LinkedIn (sample)', value: 'linkedin' },
];

export function JobSourcePanel() {
  const [source, setSource] = useState('mock');
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  async function handleFetch() {
    setLoading(true);
    setResult('');

    try {
      const response = await fetch(`/api/jobs?source=${source}`);
      const data = await response.json();
      setResult(JSON.stringify(data.jobs, null, 2));
    } catch (error) {
      setResult('Failed to fetch source.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <select value={source} onChange={(event) => setSource(event.target.value)}>
          {SOURCE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button type="button" onClick={handleFetch} disabled={loading}>
          {loading ? 'Fetching...' : 'Fetch jobs'}
        </button>
      </div>
      <pre style={{ background: '#f3f4f6', borderRadius: '16px', padding: '1rem', maxHeight: '320px', overflow: 'auto' }}>
        {result || 'Fetch a source to inspect the returned jobs.'}
      </pre>
    </div>
  );
}
