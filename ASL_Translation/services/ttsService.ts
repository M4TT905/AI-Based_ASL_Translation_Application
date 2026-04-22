import * as Speech from "expo-speech";

export function speakWord(word: string, onDone?: () => void): void {
  Speech.stop();
  Speech.speak(word, { language: "en-US", rate: 0.9, onDone });
}

export function stop(): void {
  Speech.stop();
}

export async function isAvailable(): Promise<boolean> {
  const isSpeaking = await Speech.isSpeakingAsync();
  return !isSpeaking;
}
