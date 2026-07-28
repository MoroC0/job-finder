export const WORKDAY_COUNTRY_OPTIONS = [
  { value: 'any', label: 'Any country', id: null },
  { value: 'denmark', label: 'Denmark', id: '49ab063f422741e2aef271de00efeac8' },
  { value: 'france', label: 'France', id: '54c5b6971ffb4bf0b116fe7651ec789a' },
  { value: 'germany', label: 'Germany', id: 'dcc5b7608d8644b3a93716604e78e995' },
  { value: 'italy', label: 'Italy', id: '8cd04a563fd94da7b06857a79faaf815' },
  { value: 'netherlands', label: 'Netherlands', id: '9696868b09c64d52a62ee13b052383cc' },
  { value: 'norway', label: 'Norway', id: 'd07f8ca8625e4345b98a91d0558b872a' },
  { value: 'poland', label: 'Poland', id: '131d5ac7e3ee4d7b962bdc96e498e412' },
  { value: 'spain', label: 'Spain', id: 'bd34c524a6a04ae6915f5d96fa086199' },
  { value: 'sweden', label: 'Sweden', id: '6a800a4736884df5826858d435650f45' },
  { value: 'united-kingdom', label: 'United Kingdom', id: '29247e57dbaf46fb855b224e03170bc7' },
  {
    value: 'united-states',
    label: 'United States',
    id: 'bc33aa3152ec42d4995f4791a106ed09',
  },
] as const;

export type WorkdayCountryKey = (typeof WORKDAY_COUNTRY_OPTIONS)[number]['value'];

export function isWorkdayCountryKey(value: string): value is WorkdayCountryKey {
  return WORKDAY_COUNTRY_OPTIONS.some((country) => country.value === value);
}

export function getWorkdayCountryId(country: WorkdayCountryKey): string | null {
  return WORKDAY_COUNTRY_OPTIONS.find((option) => option.value === country)?.id ?? null;
}
