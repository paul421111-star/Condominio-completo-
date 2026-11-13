import { SITE } from '../data/condo';
import type { Weather } from '../store';

const URL_METEO =
  `https://api.open-meteo.com/v1/forecast?latitude=${SITE.lat}&longitude=${SITE.lon}` +
  '&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,cloud_cover,is_day' +
  '&timezone=America%2FSao_Paulo';

export async function fetchWeather(): Promise<Weather> {
  const r = await fetch(URL_METEO);
  const c = (await r.json()).current;
  return {
    temp: c.temperature_2m,
    code: c.weather_code,
    precip: c.precipitation,
    humidity: c.relative_humidity_2m,
    wind: c.wind_speed_10m,
    cloud: c.cloud_cover,
    isDay: !!c.is_day,
    updated: new Date(),
  };
}

const CODES: [number[], string, string][] = [
  [[0], 'Céu limpo', 'sun'],
  [[1], 'Poucas nuvens', 'sun-cloud'],
  [[2], 'Parcialmente nublado', 'sun-cloud'],
  [[3], 'Nublado', 'cloud'],
  [[45, 48], 'Neblina', 'fog'],
  [[51, 53, 55, 56, 57], 'Garoa', 'drizzle'],
  [[61, 63, 66, 80, 81], 'Chuva', 'rain'],
  [[65, 67, 82], 'Chuva forte', 'rain'],
  [[71, 73, 75, 77, 85, 86], 'Neve', 'cloud'],
  [[95, 96, 99], 'Tempestade', 'storm'],
];

export function describeWeather(code: number) {
  const hit = CODES.find(([codes]) => codes.includes(code));
  return { label: hit?.[1] ?? '—', icon: hit?.[2] ?? 'cloud' };
}

export function isRaining(w: Weather | null) {
  return !!w && (w.precip > 0 || [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(w.code));
}
