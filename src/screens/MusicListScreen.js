import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  Platform
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { Ionicons } from '@expo/vector-icons';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';

// 创建一个全局的音频播放器对象和状态，便于多个页面共享
let globalSound = null;
let globalIsPlaying = false;
let globalCurrentSong = null;

const MusicListScreen = ({ navigation, route }) => {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPlayingSong, setCurrentPlayingSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [refreshList, setRefreshList] = useState(0); // 用于强制刷新列表
  const [isLoading, setIsLoading] = useState(false);

  // 初始加载
  useEffect(() => {
    requestPermissionsAndGetSongs();
    
    // 设置音频模式
    setupAudioMode();
    
    // 如果全局已有播放信息，则同步到本地状态
    if (globalCurrentSong) {
      setCurrentPlayingSong(globalCurrentSong);
      setIsPlaying(globalIsPlaying);
    }

    // 组件卸载时清理
    return () => {
      // 不需要在这里释放globalSound，因为我们希望在页面之间保持播放
    };
  }, []);

  // 监听从播放屏幕返回
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // 同步全局状态到本地
      if (globalCurrentSong) {
        console.log('回到列表页面，当前播放:', globalCurrentSong.title, globalIsPlaying ? '播放中' : '已暂停');
        setCurrentPlayingSong(globalCurrentSong);
        setIsPlaying(globalIsPlaying);
        setIsLoading(false); // 确保加载状态也被重置
        // 强制重新渲染列表
        setRefreshList(prev => prev + 1);
      }
    });

    // 添加一个定时刷新，确保UI始终反映最新的播放状态
    const interval = setInterval(() => {
      // 检查全局状态是否变化
      if (globalCurrentSong) {
        const isGlobalDifferent = (!currentPlayingSong || globalCurrentSong.id !== currentPlayingSong.id);
        const isPlayStateChanged = (globalIsPlaying !== isPlaying);
        const isLoadStateChanged = (isLoading !== false && globalIsPlaying); // 如果在播放中，不应该显示加载状态
        
        if (isGlobalDifferent || isPlayStateChanged || isLoadStateChanged) {
          console.log('检测到播放状态变化:', 
            isGlobalDifferent ? '歌曲变化' : '', 
            isPlayStateChanged ? '播放状态变化' : '',
            '全局歌曲:', globalCurrentSong.title, 
            globalIsPlaying ? '播放中' : '已暂停');
            
          setCurrentPlayingSong(globalCurrentSong);
          setIsPlaying(globalIsPlaying);
          if (isLoadStateChanged) setIsLoading(false);
          setRefreshList(prev => prev + 1);
        }
      }
    }, 300); // 更快的刷新频率

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [navigation, currentPlayingSong, isPlaying, isLoading]);

  const setupAudioMode = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        interruptionModeIOS: InterruptionModeIOS.DuckOthers,
        interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    } catch (error) {
      console.error('设置音频模式失败:', error);
    }
  };

  const requestPermissionsAndGetSongs = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('权限被拒绝', '请授予媒体库访问权限以扫描本地音乐文件');
        setLoading(false);
        return;
      }

      const media = await MediaLibrary.getAssetsAsync({
        mediaType: MediaLibrary.MediaType.audio,
        first: 1000, // 限制获取的音乐数量
      });

      const musicFiles = media.assets.filter(item => {
        // 过滤出常见的音乐文件格式
        const filename = item.filename.toLowerCase();
        return filename.endsWith('.mp3') || 
               filename.endsWith('.m4a') || 
               filename.endsWith('.wav') || 
               filename.endsWith('.flac') ||
               filename.endsWith('.aac');
      });

      // 获取更多详细信息
      const songsWithDetails = await Promise.all(
        musicFiles.map(async (item) => {
          const asset = await MediaLibrary.getAssetInfoAsync(item.id);
          return {
            id: item.id,
            title: item.filename.replace(/\.[^/.]+$/, ""), // 移除扩展名
            artist: asset.artist || '未知艺术家',
            album: asset.album || '未知专辑',
            duration: item.duration,
            uri: asset.uri
          };
        })
      );

      setSongs(songsWithDetails);
      setLoading(false);
    } catch (error) {
      console.error('获取音乐文件失败', error);
      Alert.alert('错误', '获取音乐文件失败: ' + error.message);
      setLoading(false);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

  const handlePlayPause = async (song) => {
    try {
      const isSameSong = globalCurrentSong && globalCurrentSong.id === song.id;
      
      // 如果是同一首歌，则切换播放/暂停状态
      if (isSameSong && globalSound) {
        if (globalIsPlaying) {
          // 暂停当前歌曲
          await globalSound.pauseAsync();
          globalIsPlaying = false;
          setIsPlaying(false);
        } else {
          // 继续播放当前歌曲
          await globalSound.playAsync();
          globalIsPlaying = true;
          setIsPlaying(true);
        }
        
        // 立即更新UI状态以反映变化
        setCurrentPlayingSong(globalCurrentSong);
      } else {
        // 播放新歌曲
        await playNewSong(song);
        
        // 播放新歌曲后更新UI状态
        setCurrentPlayingSong(globalCurrentSong);
        setIsPlaying(globalIsPlaying);
      }
    } catch (error) {
      console.error('播放/暂停操作失败:', error);
      Alert.alert('错误', '播放/暂停操作失败: ' + error.message);
    }
  };

  const playNewSong = async (song) => {
    try {
      console.log('开始播放新歌曲:', song.title);
      
      // 设置加载状态
      setIsLoading(true);
      
      // 卸载之前的音频
      if (globalSound) {
        console.log('卸载当前音频');
        try {
          await globalSound.stopAsync(); // 先停止播放
          await globalSound.unloadAsync();
        } catch (error) {
          console.error('卸载音频失败:', error);
        }
        globalSound = null;
      }

      // 加载新的音频
      console.log('创建新音频对象...');
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: song.uri },
        { shouldPlay: false, progressUpdateIntervalMillis: 300 }, // 先不播放，手动控制
        onPlaybackStatusUpdate
      );

      // 更新全局状态
      globalSound = newSound;
      globalCurrentSong = song;
      
      // 立即更新本地状态，不需要等待下一个渲染周期
      setCurrentPlayingSong(song);
      
      // 开始播放
      try {
        const playResult = await newSound.playAsync();
        console.log('播放结果:', playResult.isPlaying ? '播放成功' : '播放失败');
        
        globalIsPlaying = playResult.isPlaying;
        setIsPlaying(playResult.isPlaying);
      } catch (playError) {
        console.error('播放操作失败:', playError);
        Alert.alert('错误', '播放操作失败: ' + playError.message);
        globalIsPlaying = false;
        setIsPlaying(false);
      }
      
      setIsLoading(false);
      console.log('新歌曲播放初始化完成:', song.title);
      
      return globalSound;
    } catch (error) {
      console.error('播放新歌曲失败:', error);
      Alert.alert('错误', '播放新歌曲失败: ' + error.message);
      setIsLoading(false);
      return null;
    }
  };

  // 播放状态更新回调
  const onPlaybackStatusUpdate = (status) => {
    if (status.isLoaded) {
      // 同步播放状态
      const newPlayingState = status.isPlaying;
      if (globalIsPlaying !== newPlayingState) {
        console.log('播放状态更新:', newPlayingState ? '播放中' : '已暂停', '歌曲:', globalCurrentSong?.title);
        globalIsPlaying = newPlayingState;
        setIsPlaying(newPlayingState);
      }
      
      // 检查当前播放的歌曲是否与UI显示的一致
      if (globalCurrentSong && currentPlayingSong && globalCurrentSong.id !== currentPlayingSong.id) {
        console.log('当前播放歌曲变化，更新UI:', globalCurrentSong.title);
        setCurrentPlayingSong(globalCurrentSong);
        setRefreshList(prev => prev + 1);
      }
      
      // 处理播放完成事件
      if (status.didJustFinish && songs.length > 0 && globalCurrentSong) {
        console.log('当前歌曲播放完成，准备播放下一首');
        const currentIndex = songs.findIndex(s => s.id === globalCurrentSong.id);
        if (currentIndex !== -1 && currentIndex < songs.length - 1) {
          // 播放下一首
          console.log('播放下一首歌曲:', songs[currentIndex + 1].title);
          playNewSong(songs[currentIndex + 1]);
        } else if (songs.length > 0) {
          // 循环播放：如果是最后一首，则播放第一首
          console.log('播放列表第一首歌曲:', songs[0].title);
          playNewSong(songs[0]);
        }
      }
    } else if (status.error) {
      console.error('音频播放错误:', status.error);
      Alert.alert('播放错误', '音频播放出现错误，请尝试播放其他歌曲');
    }
  };

  const navigateToPlayer = (song) => {
    // 如果选择了当前未播放的歌曲，则开始播放
    if (!globalCurrentSong || globalCurrentSong.id !== song.id) {
      console.log('导航到播放页面并开始播放新歌曲:', song.title);
      playNewSong(song).then(() => {
        setCurrentPlayingSong(globalCurrentSong);
        setIsPlaying(globalIsPlaying);
      });
    } else {
      console.log('导航到播放页面，继续播放当前歌曲:', song.title);
    }
    
    // 导航到播放页面
    navigation.navigate('MusicPlayer', { 
      song: globalCurrentSong || song,
      allSongs: songs
    });
  };

  const renderSongItem = ({ item }) => {
    const isCurrentSong = currentPlayingSong && currentPlayingSong.id === item.id;
    
    return (
      <TouchableOpacity 
        style={[
          styles.songItem, 
          isCurrentSong && styles.playingSongItem
        ]}
        onPress={() => navigateToPlayer(item)}
        disabled={isLoading} // 加载中禁用点击
      >
        <View style={styles.songInfo}>
          <Text 
            style={[
              styles.songTitle, 
              isCurrentSong && styles.playingSongTitle
            ]} 
            numberOfLines={1}
          >
            {item.title}
          </Text>
          <Text 
            style={[
              styles.songArtist,
              isCurrentSong && styles.playingSongArtist
            ]} 
            numberOfLines={1}
          >
            {item.artist} • {formatDuration(item.duration)}
          </Text>
        </View>
        <TouchableOpacity 
          onPress={(e) => {
            e.stopPropagation(); // 阻止触发外层的onPress
            handlePlayPause(item);
          }} 
          style={styles.playButton}
          disabled={isLoading} // 加载中禁用点击
        >
          {isCurrentSong && isLoading ? (
            <ActivityIndicator size="small" color="#1DB954" />
          ) : (
            <Ionicons 
              name={isCurrentSong && isPlaying ? "pause-circle" : "play-circle-outline"} 
              size={32} 
              color={isCurrentSong ? "#1DB954" : "#555"} 
            />
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.loadingText}>扫描音乐文件中...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {songs.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="musical-notes" size={72} color="#ccc" />
          <Text style={styles.emptyText}>找不到音乐文件</Text>
          <Text style={styles.emptySubText}>请确保您的设备上有音乐文件</Text>
        </View>
      ) : (
        <>
          <View style={styles.headerContainer}>
            <Text style={styles.headerText}>共 {songs.length} 首歌曲</Text>
          </View>
          <FlatList
            data={songs}
            extraData={refreshList} // 添加这个属性以确保列表在状态变化时刷新
            keyExtractor={(item) => item.id}
            renderItem={renderSongItem}
            contentContainerStyle={styles.listContainer}
          />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#555',
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerText: {
    fontSize: 14,
    color: '#666',
  },
  listContainer: {
    paddingBottom: 20,
  },
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  playingSongItem: {
    backgroundColor: '#f0f9ff',
  },
  songInfo: {
    flex: 1,
    marginRight: 10,
  },
  songTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  playingSongTitle: {
    color: '#1DB954',
    fontWeight: '600',
  },
  songArtist: {
    fontSize: 14,
    color: '#777',
  },
  playingSongArtist: {
    color: '#4a9e6b',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#555',
    marginTop: 16,
  },
  emptySubText: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
  },
  playButton: {
    padding: 8,
  },
});

export default MusicListScreen; 