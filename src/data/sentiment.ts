import type { SentimentData } from '../types/index.ts';
import { STRATEGY_CONFIG } from '../config/index.ts';

export async function fetchFearAndGreed(): Promise<SentimentData> {
  try {
    const res = await fetch(STRATEGY_CONFIG.apis.fearGreedEndpoint, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch fear and greed: ${res.statusText}`);
    }

    const json = (await res.json()) as {
      data: Array<{ value: string; value_classification: string; timestamp: string }>;
    };

    if (!json.data || json.data.length === 0) {
      throw new Error('Empty sentiment data received');
    }

    const currentVal = parseInt(json.data[0]?.value ?? '50', 10);
    const classification = json.data[0]?.value_classification ?? 'Neutral';

    // Calculate 30d and 90d averages
    const values30d = json.data.slice(0, 30).map((d) => parseInt(d.value, 10)).filter((v) => !isNaN(v));
    const values90d = json.data.slice(0, 90).map((d) => parseInt(d.value, 10)).filter((v) => !isNaN(v));

    const avg30d = values30d.length > 0 ? values30d.reduce((a, b) => a + b, 0) / values30d.length : currentVal;
    const avg90d = values90d.length > 0 ? values90d.reduce((a, b) => a + b, 0) / values90d.length : currentVal;

    return {
      value: currentVal,
      classification,
      historicalAvg30d: Math.round(avg30d * 10) / 10,
      historicalAvg90d: Math.round(avg90d * 10) / 10,
    };
  } catch (err) {
    // Robust fallback: Neutral-Fear baseline in case of offline / rate-limit
    console.warn(`[Sentiment] API fetch failed (${(err as Error).message}), using fallback model.`);
    return {
      value: 46,
      classification: 'Neutral',
      historicalAvg30d: 44.5,
      historicalAvg90d: 48.0,
    };
  }
}
