import type { WorkdayCompany } from './workday-companies';

export function buildWorkdayJobUrl(company: WorkdayCompany, externalPath: string): string {
  const normalizedPath = externalPath.startsWith('/') ? externalPath : `/${externalPath}`;
  const prefix = company.careerPathType === 'myworkdaysite'
    ? `/recruiting/${company.tenant}/${company.site}`
    : `/${company.locale}/${company.site}`;

  return `https://${company.host}${prefix}${normalizedPath}`;
}

export function getWorkdayCanonicalId(url: string | undefined): string | undefined {
  if (!url) return undefined;

  try {
    const parsedUrl = new URL(url);
    if (!isWorkdayHost(parsedUrl.hostname)) return undefined;

    const tenant = getTenantFromUrl(parsedUrl);
    const requisitionId = getRequisitionId(parsedUrl.pathname);
    if (!tenant || !requisitionId) return undefined;

    return `workday:${tenant.toLocaleLowerCase()}:${normalizeRequisitionId(requisitionId)}`;
  } catch {
    return undefined;
  }
}

export function getWorkdayRequisitionId(externalPath: string): string | undefined {
  return getRequisitionId(externalPath);
}

function getTenantFromUrl(url: URL): string | undefined {
  if (url.hostname.endsWith('.myworkdayjobs.com')) {
    return url.hostname.split('.')[0];
  }

  const pathParts = url.pathname.split('/').filter(Boolean);
  const recruitingIndex = pathParts.indexOf('recruiting');
  return recruitingIndex >= 0 ? pathParts[recruitingIndex + 1] : undefined;
}

function getRequisitionId(pathname: string): string | undefined {
  const lastPathPart = decodeURIComponent(pathname.split('/').filter(Boolean).at(-1) ?? '');
  return lastPathPart.match(/_([^_]+)$/)?.[1];
}

function normalizeRequisitionId(value: string): string {
  const hyphenCount = value.match(/-/g)?.length ?? 0;
  const withoutUrlVersion = hyphenCount >= 2 ? value.replace(/-\d+$/, '') : value;
  return withoutUrlVersion.toLocaleLowerCase();
}

function isWorkdayHost(hostname: string): boolean {
  return hostname.endsWith('.myworkdayjobs.com') || hostname.endsWith('.myworkdaysite.com');
}
