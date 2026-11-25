export type Intensity = 'suave' | 'medio' | 'fuerte';
export interface Evidence { kind: 'video' | 'playlist' | 'subscription'; title: string; url: string }
export interface ChannelData {
  id: string;
  title: string;
  description: string;
  subscribers: number | null;
  videoCount: number;
  evidence: Evidence[];
  warnings: string[];
}
export interface Roast {
  headline: string;
  text: string;
  signals: { label: string; joke: string; evidence: string }[];
  challenge: string;
}
export interface Analysis {
  channel: ChannelData;
  roast: Roast;
  source: 'demo' | 'youtube';
  engine: 'rules' | 'ai';
  intensity: Intensity;
  generatedAt: string;
  cached?: boolean;
}
export interface Health { live: boolean; ai: boolean }
