import * as Speech from "expo-speech";

export function speakWord(word: string): void {
  Speech.stop();
  Speech.speak(word, { rate: 0.9});
}

export function stop(): void {
  Speech.stop();
}

export async function isAvailable(): Promise<boolean> {
  const isSpeaking = await Speech.isSpeakingAsync();
  return !isSpeaking;
}
