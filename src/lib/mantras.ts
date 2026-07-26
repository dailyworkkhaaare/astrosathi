export interface Mantra {
  sanskrit: string;
  transliteration: string;
}

export const MANTRAS: readonly Mantra[] = [
  {
    sanskrit: "ॐ भूर्भुवः स्वः तत्सवितुर्वरेण्यं",
    transliteration: "Om Bhur Bhuvah Svah Tat Savitur Varenyam",
  },
  {
    sanskrit: "ॐ नमः शिवाय",
    transliteration: "Om Namah Shivaya",
  },
  {
    sanskrit: "लोकाः समस्ताः सुखिनो भवन्तु",
    transliteration: "Lokah Samastah Sukhino Bhavantu",
  },
  {
    sanskrit: "असतो मा सद्गमय",
    transliteration: "Asato Ma Sad Gamaya",
  },
  {
    sanskrit: "ॐ शांति शांति शांतिः",
    transliteration: "Om Shanti Shanti Shantihi",
  },
  {
    sanskrit: "सर्वे भवन्तु सुखिनः",
    transliteration: "Sarve Bhavantu Sukhinah",
  },
  {
    sanskrit: "ॐ त्र्यम्बकं यजामहे",
    transliteration: "Om Tryambakam Yajamahe",
  },
] as const;

export function getDailyMantraIndex(date: Date = new Date()): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const diff = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start;
  const dayOfYear = Math.floor(diff / 86_400_000);
  return dayOfYear % MANTRAS.length;
}
