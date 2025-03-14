import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';

import MusicListScreen from './src/screens/MusicListScreen';
import MusicPlayerScreen from './src/screens/MusicPlayerScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Stack.Navigator initialRouteName="MusicList">
        <Stack.Screen 
          name="MusicList" 
          component={MusicListScreen} 
          options={{ title: '我的音乐' }} 
        />
        <Stack.Screen 
          name="MusicPlayer" 
          component={MusicPlayerScreen} 
          options={{ title: '正在播放' }} 
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
}); 