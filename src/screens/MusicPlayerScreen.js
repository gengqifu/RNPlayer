import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';

const { width } = Dimensions.get('window');

// 全局音频状态 - 从MusicListScreen.js中共享
// 这些变量需要在MusicListScreen.js中定义
// 如果在独立的文件中，这些应该被导出和导入
// 这里的声明只是为了TypeScript类型检查，实际值会被MusicListScreen.js中的值覆盖
let globalSound = null;
let globalIsPlaying = false;
let globalCurrentSong = null;

const MusicPlayerScreen = ({ route, navigation }) => {
  const { song, allSongs } = route.params;
  const [isPlaying, setIsPlaying] = useState(globalIsPlaying);
  const [isLoading, setIsLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [currentSong, setCurrentSong] = useState(globalCurrentSong || song);
  const [isSeeking, setIsSeeking] = useState(false);
  const positionRef = useRef(0);
  
  // 查找当前歌曲在列表中的索引
  const currentIndex = allSongs.findIndex(s => s.id === currentSong.id);
  
  // 调试日志
  console.log("当前播放:", currentSong?.title, "全局播放:", globalCurrentSong?.title);
  console.log("当前索引:", currentIndex, "总歌曲数:", allSongs.length);

  // 组件挂载时，确保音频已经加载
  useEffect(() => {
    console.log('MusicPlayerScreen 挂载，当前歌曲:', currentSong?.title);
    
    if (!globalSound && currentSong) {
      console.log('没有全局音频，加载当前歌曲');
      loadSound(currentSong);
    } else if (globalSound && globalCurrentSong) {
      // 已有正在播放的音频，同步状态
      console.log('有全局音频，同步状态:', globalCurrentSong.title, globalIsPlaying ? '播放中' : '已暂停');
      setCurrentSong(globalCurrentSong);
      setIsPlaying(globalIsPlaying);
      updateSoundStatus();
    }

    // 监听导航焦点变化
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('MusicPlayerScreen 获得焦点，同步状态');
      if (globalCurrentSong) {
        // 返回该页面时同步全局状态
        setCurrentSong(globalCurrentSong);
        setIsPlaying(globalIsPlaying);
        updateSoundStatus();
      }
    });

    return () => {
      // 不在组件卸载时释放globalSound，因为我们希望在页面之间保持播放
      console.log('MusicPlayerScreen 卸载');
      unsubscribe();
    };
  }, [navigation]);

  // 监听播放状态变化
  useEffect(() => {
    console.log('设置播放状态检查定时器');
    
    const checkSoundStatus = async () => {
      updateSoundStatus();
    };
    
    const interval = setInterval(checkSoundStatus, 500); // 更快的刷新频率
    
    return () => {
      console.log('清除播放状态检查定时器');
      clearInterval(interval);
    };
  }, []);

  // 获取并更新音频当前状态
  const updateSoundStatus = async () => {
    if (globalSound && !isSeeking) {
      try {
        const status = await globalSound.getStatusAsync();
        if (status.isLoaded) {
          setDuration(status.durationMillis / 1000);
          setPosition(status.positionMillis / 1000);
          
          // 同步播放状态
          if (isPlaying !== status.isPlaying) {
            console.log('同步播放状态:', status.isPlaying ? '播放中' : '已暂停');
            setIsPlaying(status.isPlaying);
          }
          
          positionRef.current = status.positionMillis / 1000;
          
          // 确保全局状态与音频实际状态一致
          if (globalIsPlaying !== status.isPlaying) {
            console.log('更新全局播放状态:', status.isPlaying ? '播放中' : '已暂停');
            globalIsPlaying = status.isPlaying;
          }
          
          // 确保当前歌曲与全局歌曲一致
          if (globalCurrentSong && currentSong && globalCurrentSong.id !== currentSong.id) {
            console.log('同步当前歌曲:', globalCurrentSong.title);
            setCurrentSong(globalCurrentSong);
          }
        }
      } catch (error) {
        console.error('获取音频状态失败:', error);
      }
    }
  };

  // 加载音频并开始播放
  const loadSound = async (songToLoad) => {
    if (!songToLoad || !songToLoad.uri) {
      console.error('无效的歌曲数据');
      Alert.alert('错误', '无效的歌曲数据');
      setIsLoading(false);
      return false;
    }
    
    console.log('正在加载新歌曲:', songToLoad.title);
    console.log('歌曲URI:', songToLoad.uri);
    
    try {
      setIsLoading(true);
      
      // 先更新currentSong状态，UI立即反应
      setCurrentSong(songToLoad);
      
      // 卸载之前的音频
      if (globalSound) {
        console.log('卸载之前的音频');
        try {
          await globalSound.stopAsync(); // 确保先停止播放
          await globalSound.unloadAsync();
        } catch (err) {
          console.error('卸载之前音频出错:', err);
        }
        globalSound = null;
      }

      // 设置音频模式
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        interruptionModeIOS: InterruptionModeIOS.DuckOthers,
        interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      console.log('开始创建音频对象, 歌曲:', songToLoad.title);
      
      // 创建新的音频对象并加载，但不自动播放
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: songToLoad.uri },
        { shouldPlay: false, progressUpdateIntervalMillis: 300 }, // 先不播放，单独控制
        onPlaybackStatusUpdate
      );
      
      console.log('音频对象创建成功，准备播放');
      
      // 先更新全局状态
      globalSound = newSound;
      globalCurrentSong = songToLoad;
      
      // 然后尝试播放
      try {
        const playResult = await newSound.playAsync();
        console.log('播放结果:', playResult.isPlaying ? '播放中' : '未播放', '歌曲:', songToLoad.title);
        
        // 播放成功后更新播放状态
        globalIsPlaying = true;
        setIsPlaying(true);
      } catch (playError) {
        console.error('播放操作失败:', playError);
        Alert.alert('错误', '播放操作失败: ' + playError.message);
        globalIsPlaying = false;
        setIsPlaying(false);
      }
      
      setIsLoading(false);
      console.log('歌曲加载成功:', songToLoad.title);
      return true;
    } catch (error) {
      console.error('加载音频失败:', error);
      Alert.alert('错误', '加载音频失败: ' + error.message);
      setIsLoading(false);
      return false;
    }
  };

  const onPlaybackStatusUpdate = (status) => {
    if (status.isLoaded) {
      // 更新持续时间
      if (status.durationMillis && status.durationMillis > 0) {
        setDuration(status.durationMillis / 1000);
      }
      
      // 如果不在拖动进度条，则更新位置
      if (!isSeeking && status.positionMillis) {
        setPosition(status.positionMillis / 1000);
        positionRef.current = status.positionMillis / 1000;
      }
      
      // 同步播放状态
      const newPlayingState = status.isPlaying;
      if (globalIsPlaying !== newPlayingState) {
        console.log('音频状态回调，播放状态变化:', newPlayingState ? '播放中' : '已暂停', '歌曲:', globalCurrentSong?.title);
        globalIsPlaying = newPlayingState;
        setIsPlaying(newPlayingState);
      }

      // 处理播放完成事件
      if (status.didJustFinish) {
        console.log('播放完成，自动播放下一首');
        playNextSong();
      }
    } else if (status.error) {
      console.error('音频播放错误:', status.error);
      Alert.alert('播放错误', '音频播放出现错误，请尝试播放其他歌曲');
    }
  };

  const togglePlayPause = async () => {
    if (globalSound) {
      try {
        if (isPlaying) {
          await globalSound.pauseAsync();
          globalIsPlaying = false;
          setIsPlaying(false);
        } else {
          await globalSound.playAsync();
          globalIsPlaying = true;
          setIsPlaying(true);
        }
      } catch (error) {
        console.error('播放/暂停操作失败:', error);
      }
    }
  };

  const playPreviousSong = async () => {
    console.log('尝试播放上一首歌曲');
    
    // 先设置加载状态
    setIsLoading(true);
    
    // 使用最新的currentSong状态查找索引
    let songToPlay = null;
    const currentIdx = allSongs.findIndex(s => s.id === currentSong.id);
    console.log('当前歌曲索引:', currentIdx, '当前歌曲:', currentSong.title);
    
    if (currentIdx > 0) {
      songToPlay = allSongs[currentIdx - 1];
    } else if (allSongs.length > 0) {
      // 循环播放：如果是第一首，则播放最后一首
      songToPlay = allSongs[allSongs.length - 1];
    }
    
    if (songToPlay) {
      console.log('切换到上一首:', songToPlay.title);
      
      // 直接更新UI状态
      setCurrentSong(songToPlay);
      
      // 加载并播放新歌曲
      const success = await loadSound(songToPlay);
      if (!success) {
        console.error('加载上一首歌曲失败:', songToPlay.title);
        Alert.alert('错误', '无法加载上一首歌曲');
        setIsLoading(false);
        
        // 加载失败时恢复当前歌曲
        setCurrentSong(currentSong);
      }
    } else {
      console.log('找不到上一首歌曲');
      setIsLoading(false);
    }
  };

  const playNextSong = async () => {
    console.log('尝试播放下一首歌曲');
    
    // 先设置加载状态
    setIsLoading(true);
    
    // 使用最新的currentSong状态查找索引
    let songToPlay = null;
    const currentIdx = allSongs.findIndex(s => s.id === currentSong.id);
    console.log('当前歌曲索引:', currentIdx, '当前歌曲:', currentSong.title);
    
    if (currentIdx < allSongs.length - 1) {
      songToPlay = allSongs[currentIdx + 1];
    } else if (allSongs.length > 0) {
      // 循环播放：如果是最后一首，则播放第一首
      songToPlay = allSongs[0];
    }
    
    if (songToPlay) {
      console.log('切换到下一首:', songToPlay.title);
      
      // 直接更新UI状态
      setCurrentSong(songToPlay);
      
      // 加载并播放新歌曲
      const success = await loadSound(songToPlay);
      if (!success) {
        console.error('加载下一首歌曲失败:', songToPlay.title);
        Alert.alert('错误', '无法加载下一首歌曲');
        setIsLoading(false);
        
        // 加载失败时恢复当前歌曲
        setCurrentSong(currentSong);
      }
    } else {
      console.log('找不到下一首歌曲');
      setIsLoading(false);
    }
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const onSlidingStart = () => {
    setIsSeeking(true);
  };

  const onSlidingComplete = async (value) => {
    if (globalSound) {
      try {
        await globalSound.setPositionAsync(value * 1000);
        setPosition(value);
        setIsSeeking(false);
      } catch (error) {
        console.error('设置音频位置失败:', error);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.albumContainer}>
        <View style={styles.albumCover}>
          <Ionicons name="musical-notes" size={100} color="#666" />
        </View>
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.songTitle} numberOfLines={1}>
          {currentSong.title}
        </Text>
        <Text style={styles.artistName} numberOfLines={1}>
          {currentSong.artist || '未知艺术家'} • {currentSong.album || '未知专辑'}
        </Text>
      </View>

      <View style={styles.controlsContainer}>
        <View style={styles.progressContainer}>
          <Slider
            style={styles.progressBar}
            minimumValue={0}
            maximumValue={duration}
            value={position}
            minimumTrackTintColor="#1DB954"
            maximumTrackTintColor="#ddd"
            thumbTintColor="#1DB954"
            onSlidingStart={onSlidingStart}
            onSlidingComplete={onSlidingComplete}
            disabled={isLoading}
          />
          <View style={styles.timeContainer}>
            <Text style={styles.timeText}>{formatTime(position)}</Text>
            <Text style={styles.timeText}>{formatTime(duration)}</Text>
          </View>
        </View>

        <View style={styles.buttonsContainer}>
          <TouchableOpacity 
            onPress={playPreviousSong} 
            style={styles.controlButton}
            disabled={isLoading}
          >
            <Ionicons name="play-skip-back" size={32} color={isLoading ? "#aaa" : "#333"} />
          </TouchableOpacity>

          {isLoading ? (
            <ActivityIndicator size="large" color="#1DB954" />
          ) : (
            <TouchableOpacity onPress={togglePlayPause} style={styles.playButton}>
              <Ionicons
                name={isPlaying ? "pause-circle" : "play-circle"}
                size={70}
                color="#1DB954"
              />
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            onPress={playNextSong} 
            style={styles.controlButton}
            disabled={isLoading}
          >
            <Ionicons name="play-skip-forward" size={32} color={isLoading ? "#aaa" : "#333"} />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    justifyContent: 'space-between',
  },
  albumContainer: {
    flex: 0.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  albumCover: {
    width: width - 100,
    height: width - 100,
    borderRadius: 20,
    backgroundColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  infoContainer: {
    flex: 0.2,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  songTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  artistName: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  controlsContainer: {
    flex: 0.3,
    justifyContent: 'flex-end',
    paddingBottom: 20,
  },
  progressContainer: {
    width: '100%',
    marginBottom: 20,
  },
  progressBar: {
    width: '100%',
    height: 20,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  timeText: {
    fontSize: 12,
    color: '#777',
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  controlButton: {
    paddingHorizontal: 20,
  },
  playButton: {
    marginHorizontal: 30,
  },
});

export default MusicPlayerScreen; 