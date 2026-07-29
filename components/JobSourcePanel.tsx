'use client';

import { useState, type FormEvent } from 'react';
import { JobList } from '@/components/JobList';
import type { Job } from '@/lib/types';
import {
  DEFAULT_JOB_SEARCH,
  MAX_KEYWORD_QUERIES,
  MAX_LINKEDIN_LOCATION_QUERIES,
  type JobSearchParams,
  type JobSourceKey,
  type JobSourceResult,
} from '@/lib/job-service';
import { WORKDAY_COMPANY_NAMES } from '@/lib/sources/workday-companies';
import {
  WORKDAY_COUNTRY_OPTIONS,
  type WorkdayCountryKey,
} from '@/lib/sources/workday-countries';

const LOCATION_SUGGESTIONS = ['Remote', 'Copenhagen', 'London', 'Berlin', 'Amsterdam', 'Milan', 'Zürich', 'Basel', 'Bern', 'Geneva', 'Lausanne'];
const SOURCE_OPTIONS: Array<{ label: string; value: JobSourceKey }> = [
  { label: 'LinkedIn', value: 'linkedin' },
  { label: 'Jobindex.dk', value: 'jobindex' },
  { label: 'Workindenmark', value: 'workindenmark' },
  { label: 'Workday companies', value: 'workday' },
];
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
const RESULT_LIMIT_OPTIONS = [25, 50, 75, 100] as const;

interface JobsApiSuccess {
  requestedSources: JobSourceKey[];
  fallbackApplied: boolean;
  search: Required<JobSearchParams>;
  keywordQueries: string[];
  locationQueries: string[];
  jobs: Job[];
  results: JobSourceResult[];
}

interface JobsApiError {
  error: string;
  validSources?: JobSourceKey[];
}

export function JobSourcePanel() {
  const [selectedSources, setSelectedSources] = useState<JobSourceKey[]>(['linkedin']);
  const [keywords, setKeywords] = useState(DEFAULT_JOB_SEARCH.keywords);
  const [location, setLocation] = useState(DEFAULT_JOB_SEARCH.location);
  const [linkedinLocations, setLinkedinLocations] = useState(
    DEFAULT_JOB_SEARCH.linkedinLocations
  );
  const [company, setCompany] = useState(DEFAULT_JOB_SEARCH.company);
  const [datePosted, setDatePosted] = useState(DEFAULT_JOB_SEARCH.datePosted);
  const [experienceLevel, setExperienceLevel] = useState(DEFAULT_JOB_SEARCH.experienceLevel);
  const [workplaceType, setWorkplaceType] = useState(DEFAULT_JOB_SEARCH.workplaceType);
  const [jobType, setJobType] = useState(DEFAULT_JOB_SEARCH.jobType);
  const [workdayCountry, setWorkdayCountry] = useState<WorkdayCountryKey>(
    DEFAULT_JOB_SEARCH.workdayCountry
  );
  const [resultLimit, setResultLimit] = useState(DEFAULT_JOB_SEARCH.resultLimit);
  const [result, setResult] = useState<JobsApiSuccess | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  async function handleFetch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setResult(null);
    setError('');

    try {
      const params = new URLSearchParams({
        keywords,
        location,
        linkedinLocations,
        company,
        datePosted,
        experienceLevel,
        workplaceType,
        jobType,
        resultLimit: String(resultLimit),
      });
      selectedSources.forEach((source) => params.append('source', source));
      if (selectedSources.includes('workday')) {
        params.set('workdayCountry', workdayCountry);
      }
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

  const displayedJobs = result?.jobs ?? [];
  const activeSearch = result?.search ?? DEFAULT_JOB_SEARCH;
  const activeKeywordQueries = result?.keywordQueries ?? [DEFAULT_JOB_SEARCH.keywords];
  const activeLocationQueries = result?.locationQueries ?? [
    DEFAULT_JOB_SEARCH.linkedinLocations,
  ];
  const activeSources = result?.requestedSources ?? ['linkedin'];
  const hasLinkedIn = selectedSources.includes('linkedin');
  const hasOtherSources = selectedSources.some((source) => source !== 'linkedin');

  function handleSourceToggle(source: JobSourceKey) {
    setSelectedSources((current) => {
      if (!current.includes(source)) return [...current, source];
      return current.length === 1 ? current : current.filter((item) => item !== source);
    });
  }

  return (
    <div className="search-experience">
      <div className="section-header">
        <h2>Search job sources</h2>
        <p>Run the same independent role searches across one or more sources, then review one newest-first feed.</p>
      </div>
      <div className="search-layout">
        <form className="search-form-card" onSubmit={handleFetch}>
          <div className="search-form-grid">
            <label className="field-group field-group--wide">
              <span>Keywords</span>
              <input
                type="text"
                value={keywords}
                onChange={(event) => setKeywords(event.target.value)}
                placeholder="e.g. software engineer, AI engineer, fullstack developer"
                className="search-field"
              />
              <small className="field-hint">
                Separate up to {MAX_KEYWORD_QUERIES} roles with commas. Each role runs as its own search.
              </small>
            </label>
            <fieldset className="source-picker field-group--wide">
              <legend>Sources</legend>
              <div className="source-options">
                {SOURCE_OPTIONS.map((option) => (
                  <label className="source-option" key={option.value}>
                    <input
                      type="checkbox"
                      checked={selectedSources.includes(option.value)}
                      onChange={() => handleSourceToggle(option.value)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {hasLinkedIn ? (
              <label className="field-group field-group--wide">
                <span>LinkedIn locations</span>
                <input
                  type="text"
                  value={linkedinLocations}
                  onChange={(event) => setLinkedinLocations(event.target.value)}
                  placeholder="e.g. Zürich; Basel; Geneva"
                  className="search-field"
                />
                <small className="field-hint">
                  Separate up to {MAX_LINKEDIN_LOCATION_QUERIES} locations with semicolons. Commas remain valid inside a location.
                </small>
              </label>
            ) : null}
            {hasOtherSources ? (
              <label className="field-group">
                <span>Other-source location</span>
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
                <small className="field-hint">
                  Used by Jobindex.dk, Workindenmark, and Workday when no country facet is selected.
                </small>
              </label>
            ) : null}
            <label className="field-group">
              <span>Company</span>
              <input
                type="text"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                placeholder="Optional company name"
                className="search-field"
                list="company-suggestions"
              />
              <datalist id="company-suggestions">
                {WORKDAY_COMPANY_NAMES.map((companyName) => (
                  <option key={companyName} value={companyName} />
                ))}
              </datalist>
              <small className="field-hint">
                With Workday selected, leave this blank to search every configured company.
              </small>
            </label>
            {selectedSources.includes('workday') ? (
              <label className="field-group">
                <span>Workday country</span>
                <select
                  value={workdayCountry}
                  onChange={(event) => setWorkdayCountry(event.target.value as WorkdayCountryKey)}
                  className="search-field"
                >
                  {WORKDAY_COUNTRY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <small className="field-hint">
                  Workday only. This uses each portal&apos;s country facet instead of the shared location text.
                </small>
              </label>
            ) : null}
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
            <label className="field-group">
              <span>Results to fetch</span>
              <select
                value={resultLimit}
                onChange={(event) => setResultLimit(Number(event.target.value))}
                className="search-field"
              >
                {RESULT_LIMIT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    Up to {option} jobs
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="search-actions">
            <button type="submit" disabled={loading} className="primary-button">
              {loading ? 'Searching...' : 'Search jobs'}
            </button>
            <p className="search-helper">
              Workday searches a curated company registry in bounded batches; Jobindex remains limited to its first search page.
            </p>
          </div>
        </form>

        <aside className="search-summary-card">
          <p className="summary-label">Current focus</p>
          <h3>
            {activeKeywordQueries.length} {activeKeywordQueries.length === 1 ? 'role' : 'roles'}
            {activeSources.includes('linkedin')
              ? ` across ${activeLocationQueries.length} LinkedIn ${
                  activeLocationQueries.length === 1 ? 'location' : 'locations'
                }`
              : ''}
          </h3>
          <p className="summary-copy">
            {activeSources.includes('linkedin')
              ? `LinkedIn: ${activeLocationQueries.join(' | ')}`
              : activeSearch.location}
            {activeSources.some((source) => source !== 'linkedin')
              ? ` | Other sources: ${activeSearch.location}`
              : ''}
            {activeSearch.company ? ` | ${activeSearch.company}` : ''}
          </p>
          <div className="summary-chips">
            {activeSources.map((source) => (
              <span className="summary-chip" key={source}>{labelForSource(source)}</span>
            ))}
            {activeKeywordQueries.map((keyword) => (
              <span className="summary-chip" key={keyword}>{keyword}</span>
            ))}
            {activeSources.includes('linkedin') && activeLocationQueries.map((locationQuery) => (
              <span className="summary-chip" key={`linkedin-${locationQuery}`}>
                LinkedIn: {locationQuery}
              </span>
            ))}
            {activeSearch.datePosted !== 'any' ? <span className="summary-chip">{labelForOption(DATE_POSTED_OPTIONS, activeSearch.datePosted)}</span> : null}
            {activeSearch.experienceLevel !== 'any' ? (
              <span className="summary-chip">{labelForOption(EXPERIENCE_OPTIONS, activeSearch.experienceLevel)}</span>
            ) : null}
            {activeSearch.workplaceType !== 'any' ? (
              <span className="summary-chip">{labelForOption(WORKPLACE_OPTIONS, activeSearch.workplaceType)}</span>
            ) : null}
            {activeSearch.jobType !== 'any' ? <span className="summary-chip">{labelForOption(JOB_TYPE_OPTIONS, activeSearch.jobType)}</span> : null}
            {activeSources.includes('workday') && activeSearch.workdayCountry !== 'any' ? (
              <span className="summary-chip">
                Workday: {labelForOption(WORKDAY_COUNTRY_OPTIONS, activeSearch.workdayCountry)}
              </span>
            ) : null}
            <span className="summary-chip">Newest first</span>
            <span className="summary-chip">Up to {activeSearch.resultLimit}</span>
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
            {!result ? (
              <p className="summary-copy">
                {loading
                  ? 'Searching the selected sources now.'
                  : 'No source request has been made yet.'}
              </p>
            ) : null}
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
            {result
              ? <>Results are ordered newest first. Right now you&apos;re looking at <strong>{displayedJobs.length}</strong> jobs.</>
              : loading
                ? 'The previous results were cleared while this search runs.'
                : 'Choose your search options above, then press Enter or use the search button.'}
          </p>
        </div>
      </div>
      {loading ? (
        <p className="empty-state">Searching for the newest matching jobs...</p>
      ) : result ? (
        <JobList jobs={displayedJobs} />
      ) : (
        <p className="empty-state">
          {error
            ? 'The search did not complete. Adjust the filters or try again.'
            : 'No jobs are loaded automatically. Run a search when you are ready.'}
        </p>
      )}
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

function labelForSource(source: JobSourceKey): string {
  return SOURCE_OPTIONS.find((option) => option.value === source)?.label ?? source;
}

function hasActiveOptionalFilters(search: Required<JobSearchParams>) {
  return Boolean(
    search.company ||
      search.datePosted !== 'any' ||
      search.experienceLevel !== 'any' ||
      search.workplaceType !== 'any' ||
      search.jobType !== 'any' ||
      search.workdayCountry !== 'any'
  );
}
