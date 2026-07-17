'use client';

import { useState } from 'react';
import { JobList } from '@/components/JobList';
import type { Job } from '@/lib/types';
import {
  DEFAULT_JOB_SEARCH,
  type JobSearchParams,
  type JobSourceKey,
  type JobSourceResult,
} from '@/lib/job-service';

const LOCATION_SUGGESTIONS = ['Remote', 'London', 'New York, NY', 'San Francisco Bay Area', 'Berlin', 'Amsterdam', 'Milan'];
const DATE_POSTED_OPTIONS = [
  { label: 'Any time', value: 'any' },
  { label: 'Past 24 hours', value: 'day' },
  { label: 'Past week', value: 'week' },
  { label: 'Past month', value: 'month' },
] as const;
const EXPERIENCE_OPTIONS = [
  { label: 'Any level', value: 'any' },
  { label: 'Internship', value: 'internship' },
  { label: 'Entry level', value: 'entry' },
  { label: 'Associate', value: 'associate' },
  { label: 'Mid-Senior', value: 'mid-senior' },
  { label: 'Director', value: 'director' },
  { label: 'Executive', value: 'executive' },
] as const;
const WORKPLACE_OPTIONS = [
  { label: 'Any workplace', value: 'any' },
  { label: 'Remote', value: 'remote' },
  { label: 'Hybrid', value: 'hybrid' },
  { label: 'On-site', value: 'on-site' },
] as const;
const JOB_TYPE_OPTIONS = [
  { label: 'Any type', value: 'any' },
  { label: 'Full-time', value: 'full-time' },
  { label: 'Part-time', value: 'part-time' },
  { label: 'Contract', value: 'contract' },
  { label: 'Temporary', value: 'temporary' },
  { label: 'Internship', value: 'internship' },
] as const;

interface JobsApiSuccess {
  requestedSources: JobSourceKey[];
  fallbackApplied: boolean;
  search: Required<JobSearchParams>;
  jobs: Job[];
  results: JobSourceResult[];
}

interface JobsApiError {
  error: string;
  validSources?: JobSourceKey[];
}

interface Props {
  initialJobs: Job[];
}

export function JobSourcePanel({ initialJobs }: Props) {
  const [keywords, setKeywords] = useState(DEFAULT_JOB_SEARCH.keywords);
  const [location, setLocation] = useState(DEFAULT_JOB_SEARCH.location);
  const [company, setCompany] = useState(DEFAULT_JOB_SEARCH.company);
  const [datePosted, setDatePosted] = useState(DEFAULT_JOB_SEARCH.datePosted);
  const [experienceLevel, setExperienceLevel] = useState(DEFAULT_JOB_SEARCH.experienceLevel);
  const [workplaceType, setWorkplaceType] = useState(DEFAULT_JOB_SEARCH.workplaceType);
  const [jobType, setJobType] = useState(DEFAULT_JOB_SEARCH.jobType);
  const [result, setResult] = useState<JobsApiSuccess | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  async function handleFetch() {
    setLoading(true);
    setResult(null);
    setError('');

    try {
      const params = new URLSearchParams({
        source: 'linkedin',
        keywords,
        location,
        company,
        datePosted,
        experienceLevel,
        workplaceType,
        jobType,
      });
      const response = await fetch(`/api/jobs?${params.toString()}`);
      const data = (await response.json()) as JobsApiSuccess | JobsApiError;

      if (!response.ok) {
        setError(
          'validSources' in data && data.validSources
            ? `${data.error} Valid sources: ${data.validSources.join(', ')}`
            : 'Failed to fetch source.'
        );
        return;
      }

      setResult(data as JobsApiSuccess);
    } catch {
      setError('Failed to fetch source.');
    } finally {
      setLoading(false);
    }
  }

  const displayedJobs = result?.jobs ?? initialJobs;
  const activeSearch = result?.search ?? DEFAULT_JOB_SEARCH;

  return (
    <div className="search-experience">
      <div className="section-header">
        <h2>Search LinkedIn</h2>
        <p>Lead with search first, refine what matters, and keep the latest jobs found visible underneath.</p>
      </div>
      <div className="search-layout">
        <div className="search-form-card">
          <div className="search-form-grid">
            <label className="field-group field-group--wide">
              <span>Keywords</span>
              <input
                type="text"
                value={keywords}
                onChange={(event) => setKeywords(event.target.value)}
                placeholder="e.g. product designer, frontend engineer"
                className="search-field"
              />
            </label>
            <label className="field-group">
              <span>Location</span>
              <input
                type="text"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Choose or type a location"
                className="search-field"
                list="location-suggestions"
              />
              <datalist id="location-suggestions">
                {LOCATION_SUGGESTIONS.map((suggestion) => (
                  <option key={suggestion} value={suggestion} />
                ))}
              </datalist>
            </label>
            <label className="field-group">
              <span>Company</span>
              <input
                type="text"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                placeholder="Optional company name"
                className="search-field"
              />
            </label>
            <label className="field-group">
              <span>Date posted</span>
              <select value={datePosted} onChange={(event) => setDatePosted(event.target.value as typeof datePosted)} className="search-field">
                {DATE_POSTED_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-group">
              <span>Experience</span>
              <select
                value={experienceLevel}
                onChange={(event) => setExperienceLevel(event.target.value as typeof experienceLevel)}
                className="search-field"
              >
                {EXPERIENCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-group">
              <span>Workplace</span>
              <select
                value={workplaceType}
                onChange={(event) => setWorkplaceType(event.target.value as typeof workplaceType)}
                className="search-field"
              >
                {WORKPLACE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-group">
              <span>Job type</span>
              <select value={jobType} onChange={(event) => setJobType(event.target.value as typeof jobType)} className="search-field">
                {JOB_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="search-actions">
            <button type="button" onClick={handleFetch} disabled={loading} className="primary-button">
              {loading ? 'Searching...' : 'Search jobs'}
            </button>
            <p className="search-helper">LinkedIn is the active source for now, but the filter model is designed to expand to other adapters later.</p>
          </div>
        </div>

        <aside className="search-summary-card">
          <p className="summary-label">Current focus</p>
          <h3>{activeSearch.keywords}</h3>
          <p className="summary-copy">
            {activeSearch.location}
            {activeSearch.company ? ` | ${activeSearch.company}` : ''}
          </p>
          <div className="summary-chips">
            {activeSearch.datePosted !== 'any' ? <span className="summary-chip">{labelForOption(DATE_POSTED_OPTIONS, activeSearch.datePosted)}</span> : null}
            {activeSearch.experienceLevel !== 'any' ? (
              <span className="summary-chip">{labelForOption(EXPERIENCE_OPTIONS, activeSearch.experienceLevel)}</span>
            ) : null}
            {activeSearch.workplaceType !== 'any' ? (
              <span className="summary-chip">{labelForOption(WORKPLACE_OPTIONS, activeSearch.workplaceType)}</span>
            ) : null}
            {activeSearch.jobType !== 'any' ? <span className="summary-chip">{labelForOption(JOB_TYPE_OPTIONS, activeSearch.jobType)}</span> : null}
            {!hasActiveOptionalFilters(activeSearch) ? <span className="summary-chip">Base search</span> : null}
          </div>
          <div className="status-stack">
            {(result?.results ?? []).map((sourceResult) => (
              <div key={sourceResult.key} className="status-row">
                <strong>{sourceResult.label}</strong>
                <span className={getStatusClassName(sourceResult.status)}>{sourceResult.status}</span>
                <span>{sourceResult.jobs.length} jobs</span>
              </div>
            ))}
            {!result ? <p className="summary-copy">Showing the default LinkedIn search until you run a new one.</p> : null}
          </div>
        </aside>
      </div>

      {error ? <p style={{ color: 'var(--status-error-text)', margin: 0 }}>{error}</p> : null}
      {result?.results.some((sourceResult) => sourceResult.error) ? (
        <div className="error-panel">
          {result.results
            .filter((sourceResult) => sourceResult.error)
            .map((sourceResult) => (
              <p key={sourceResult.key}>
                <strong>{sourceResult.label}:</strong> {sourceResult.error}
              </p>
            ))}
        </div>
      ) : null}

      <div className="results-header">
        <div>
          <p className="eyebrow results-eyebrow">Latest results</p>
          <h2>Last jobs found</h2>
          <p>
            Results update from your most recent search. Right now you&apos;re looking at <strong>{displayedJobs.length}</strong> LinkedIn jobs.
          </p>
        </div>
      </div>
      <JobList jobs={displayedJobs} />
    </div>
  );
}

function getStatusClassName(status: JobSourceResult['status']) {
  switch (status) {
    case 'success':
      return 'status-pill status-pill--success';
    case 'empty':
      return 'status-pill status-pill--empty';
    case 'error':
      return 'status-pill status-pill--error';
  }
}

function labelForOption<T extends string>(options: ReadonlyArray<{ label: string; value: T }>, value: T) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function hasActiveOptionalFilters(search: Required<JobSearchParams>) {
  return Boolean(
    search.company ||
      search.datePosted !== 'any' ||
      search.experienceLevel !== 'any' ||
      search.workplaceType !== 'any' ||
      search.jobType !== 'any'
  );
}
