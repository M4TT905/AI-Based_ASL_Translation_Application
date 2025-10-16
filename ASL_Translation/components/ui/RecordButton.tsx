import React from "react";
import { Button } from "react-native-paper";

interface Props {
  isRecording: boolean;
  onStart: () => void;
  onStop: () => void;
}

export const RecordButton: React.FC<Props> = ({ isRecording, onStart, onStop }) => {
  return (
    <Button
      mode={isRecording ? "contained-tonal" : "contained"}
      icon={isRecording ? "stop" : "record"}
      onPress={isRecording ? onStop : onStart}
      style={{ margin: 16 }}
    >
      {isRecording ? "Stop Recording" : "Start Recording"}
    </Button>
  );
};