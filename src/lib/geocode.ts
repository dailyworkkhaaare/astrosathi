export type PlaceHit = {
  label: string;
  latitude: number;
  longitude: number;
  timezone: string;
};

type OMResult = {
  name?: string;
  admin1?: string;
  admin2?: string;
  admin3?: string;
  country?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
};

export async function searchPlaces(query: string): Promise<PlaceHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    q,
  )}&count=10&language=en&format=json`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = (await res.json()) as { results?: OMResult[] };
    return (json.results ?? []).map((r) => ({
      label: [r.name, r.admin2, r.admin1, r.country].filter(Boolean).join(", "),
      latitude: r.latitude,
      longitude: r.longitude,
      timezone: r.timezone ?? "UTC",
    }));
  } catch {
    return [];
  }
}
