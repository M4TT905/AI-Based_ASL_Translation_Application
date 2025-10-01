import { StyleSheet, Text, View, Button, TouchableOpacity } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';

export default function HomeScreen() {
  const [facing, setFacing] = useState<CameraType>('front');
  const [permission, requestPermission] = useCameraPermissions();


  if(!permission) {
    return (
      <View>
        <Text>Could not get permission</Text>
      </View>
    );
  }

  if(!permission.granted) {
    return(
      <View style={permissionButtonStyle.container}>
        <Button title='grant permission'/>
      </View>
    );
  }

  function toggleCameraFacing() {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  }

  return (
    <View style={mainStyle.container}>
      <TouchableOpacity style={buttonStyle.container}>
        <Text style={buttonStyle.text}>Options</Text>
      </TouchableOpacity>
      <View style={cameraStyle.container}>
        <CameraView facing='front' />
      </View>
      <View style={overlayStyle.container}>
        <Text style={overlayStyle.text}>
          Here is the translation
        </Text>
      </View>
    </View>
  );
}

const mainStyle = StyleSheet.create({
  container:{
    flex: 1,
  },
});

const permissionButtonStyle = StyleSheet.create({
  container:{
    backgroundColor: 'white',
    opacity: 0.80,
    padding: 20,
  },
  text:{
    color: 'blue',
  },
});

const buttonStyle = StyleSheet.create({
  container:{
    borderWidth: 1,
    borderRadius: 8,
    padding: 5,
    backgroundColor: '#FFF',
    position: 'absolute',
    zIndex: 1,
    left: '5%',
    top: '5%',
    opacity: 0.5,
  },
  text:{
    color: 'blue',
  },
});

const cameraStyle = StyleSheet.create({
  container:{
    height: '100%',
    backgroundColor: '#FFAAFF',
    opacity: 1,
  },
});

const overlayStyle = StyleSheet.create({
  container:{
    position: 'absolute',
    top: '80%',
    padding: 10,
    width: '100%',
    height: '20%',
    backgroundColor: '#rgba(170, 255, 170, 0.50)',
  },
  text:{
    opacity: 1,
    color: 'black',
  },
});
