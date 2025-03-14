# 本地音乐播放器

一个简单的React Native应用，可以扫描设备上的本地音乐文件并播放。

## 功能

- 扫描设备上的本地音乐文件
- 以列表形式展示扫描到的音乐
- 播放、暂停、上一首、下一首控制
- 播放进度条控制

## 技术栈

- React Native
- Expo
- Expo Media Library API (扫描媒体文件)
- Expo AV API (音频播放)

## 如何运行

### 前提条件

- Node.js (v14.0.0 或更高)
- npm 或 yarn
- 安装 Expo CLI: `npm install -g expo-cli`
- iOS开发需要Mac和Xcode
- Android开发需要Android Studio和配置好的模拟器

### 安装步骤

1. 克隆项目到本地
   ```
   git clone <repository-url>
   cd music-player
   ```

2. 安装依赖
   ```
   npm install
   ```
   或
   ```
   yarn install
   ```

3. 启动开发服务器
   ```
   npm start
   ```
   或
   ```
   yarn start
   ```

4. 在模拟器或真机上运行
   - 按下`i`在iOS模拟器上运行
   - 按下`a`在Android模拟器上运行
   - 或使用Expo Go应用扫描终端中的二维码在真机上运行

### 注意事项

- 在iOS上，需要授予媒体库访问权限才能扫描音乐文件
- 在Android上，需要授予存储权限才能访问音乐文件
- 真机测试时，需要确保设备上有音乐文件

## 许可证

MIT 