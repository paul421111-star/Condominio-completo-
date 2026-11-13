import * as SunCalc from 'suncalc';
import { Vector3 } from 'three';
import { SITE } from '../data/condo';

/** Direção unitária para o sol no referencial da cena (x = leste, z = sul, y = cima). */
const RAD = Math.PI / 180;

export function sunDirection(time: number, out = new Vector3()) {
  const p = SunCalc.getPosition(new Date(time), SITE.lat, SITE.lon);
  // suncalc 2.x: graus; azimute a partir do norte, sentido horário. Norte = −z.
  const az = p.azimuth * RAD, alt = p.altitude * RAD;
  return out.set(Math.sin(az) * Math.cos(alt), Math.sin(alt), -Math.cos(az) * Math.cos(alt));
}

/** Altitude do sol em radianos. */
export function sunAltitude(time: number) {
  return SunCalc.getPosition(new Date(time), SITE.lat, SITE.lon).altitude * RAD;
}

export function sunTimes(time: number) {
  const t = SunCalc.getTimes(new Date(time), SITE.lat, SITE.lon);
  const noon = t.solarNoon.getTime();
  return { sunrise: t.sunrise?.getTime() ?? noon - 6 * 3600_000, sunset: t.sunset?.getTime() ?? noon + 6 * 3600_000, noon };
}

const TZ = 'America/Sao_Paulo';

export const fmtTime = (t: number) =>
  new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(t);

export const fmtDate = (t: number) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', timeZone: TZ }).format(t);

export function minutesOfDay(t: number) {
  return Math.round((t - localMidnight(t)) / 60000);
}

/** Meia-noite em Brasília (UTC-3, sem horário de verão) do dia que contém t. */
export function localMidnight(t: number) {
  const d = new Date(t - 3 * 3600_000);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime() + 3 * 3600_000;
}

/** Solstícios do ano corrente, mantendo a hora do dia. */
export function presetDate(kind: 'hoje' | 'verao' | 'inverno', current: number) {
  const now = Date.now();
  if (kind === 'hoje') return localMidnight(now) + (current - localMidnight(current));
  const year = new Date(now).getUTCFullYear();
  const month = kind === 'verao' ? 11 : 5;
  const mid = Date.UTC(year, month, 21) + 3 * 3600_000;
  return mid + (current - localMidnight(current));
}
