export interface WorkdayCompany {
  key: string;
  name: string;
  aliases: string[];
  host: string;
  tenant: string;
  site: string;
  locale: string;
  careerPathType?: 'myworkdaysite';
}

export const WORKDAY_COMPANIES: WorkdayCompany[] = [
  {
    key: 'agc-biologics',
    name: 'AGC Biologics',
    aliases: ['AGC Biologics Copenhagen'],
    host: 'agcbio.wd5.myworkdayjobs.com',
    tenant: 'agcbio',
    site: 'agcbio_careers',
    locale: 'en-US',
  },
  {
    key: 'centrica',
    name: 'Centrica',
    aliases: ['Centrica Energy', 'Centrica Energy Trading'],
    host: 'centrica.wd3.myworkdayjobs.com',
    tenant: 'centrica',
    site: 'Centrica',
    locale: 'en-US',
  },
  {
    key: 'crowdstrike',
    name: 'CrowdStrike',
    aliases: ['CrowdStrike Denmark'],
    host: 'crowdstrike.wd5.myworkdayjobs.com',
    tenant: 'crowdstrike',
    site: 'crowdstrikecareers',
    locale: 'en-US',
  },
  {
    key: 'gn',
    name: 'GN Group',
    aliases: ['GN Store Nord', 'GN Audio'],
    host: 'gn.wd3.myworkdayjobs.com',
    tenant: 'gn',
    site: 'GN-Careers',
    locale: 'en-US',
  },
  {
    key: 'ipsen',
    name: 'Ipsen',
    aliases: ['Institut Produits Synthese'],
    host: 'ipsen.wd103.myworkdayjobs.com',
    tenant: 'ipsen',
    site: 'Ipsen_Careers',
    locale: 'en-US',
  },
  {
    key: 'microchip',
    name: 'Microchip Technology',
    aliases: ['Microchip'],
    host: 'microchiphr.wd5.myworkdayjobs.com',
    tenant: 'microchiphr',
    site: 'External',
    locale: 'en-US',
  },
  {
    key: 'new-balance',
    name: 'New Balance',
    aliases: [],
    host: 'newbalance.wd1.myworkdayjobs.com',
    tenant: 'newbalance',
    site: 'Careers-UK',
    locale: 'en-US',
  },
  {
    key: 'nvidia',
    name: 'NVIDIA',
    aliases: ['NVIDIA Denmark'],
    host: 'nvidia.wd5.myworkdayjobs.com',
    tenant: 'nvidia',
    site: 'NVIDIAExternalCareerSite',
    locale: 'en-US',
  },
  {
    key: 'saxo-bank',
    name: 'Saxo Bank',
    aliases: ['Saxo'],
    host: 'saxobank.wd3.myworkdayjobs.com',
    tenant: 'saxobank',
    site: 'CareeratSaxoBank',
    locale: 'en-US',
  },
  {
    key: 'simcorp',
    name: 'SimCorp',
    aliases: [],
    host: 'simcorp.wd3.myworkdayjobs.com',
    tenant: 'simcorp',
    site: 'SimCorp_Jobs',
    locale: 'en-US',
  },
  {
    key: 'spirii',
    name: 'Spirii',
    aliases: [],
    host: 'wd3.myworkdaysite.com',
    tenant: 'edenpeople',
    site: 'spirii-Careers',
    locale: 'en-US',
    careerPathType: 'myworkdaysite',
  },
  {
    key: 'workday',
    name: 'Workday',
    aliases: [],
    host: 'workday.wd5.myworkdayjobs.com',
    tenant: 'workday',
    site: 'Workday',
    locale: 'en-US',
  },
];

export const WORKDAY_COMPANY_NAMES = WORKDAY_COMPANIES.map((company) => company.name);

export function getMatchingWorkdayCompanies(companyFilter: string): WorkdayCompany[] {
  const normalizedFilter = normalizeCompanyName(companyFilter);
  if (!normalizedFilter) return WORKDAY_COMPANIES;

  return WORKDAY_COMPANIES.filter((company) =>
    [company.name, ...company.aliases].some((name) => {
      const normalizedName = normalizeCompanyName(name);
      return normalizedName.includes(normalizedFilter) || normalizedFilter.includes(normalizedName);
    })
  );
}

function normalizeCompanyName(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
