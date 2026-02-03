const path = require('path');

const asset = (p) => path.join(__dirname, p);

module.exports = {
  expo: {
    extra: {
      eas: {
        projectId: 'dc9c102a-3a7c-4441-b102-d20655247ff0',
      },
    },
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#070A12',
    },
    name: 'Mobile',
    slug: 'mobile',
    version: '1.0.0',
    orientation: 'portrait',

    icon: asset('assets/images/icon.png'),
    scheme: 'mobile',
    userInterfaceStyle: 'automatic',
    newArchEnabled: false,
    ios: { supportsTablet: true },

    android: {
      adaptiveIcon: {
        foregroundImage: asset('assets/images/myHomeOS.png'),
        backgroundColor: '#ffffff',
      },
      edgeToEdgeEnabled: true,
      package: 'app.myhomeos.mobile',
    },

    web: {
      bundler: 'metro',
      favicon: asset('assets/images/favicon.png'),
    },

    plugins: [
      [
        'expo-splash-screen',
        {
          image: asset('assets/images/splash-icon.png'),
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
        },
      ],
      [
        '@react-native-google-signin/google-signin',
        {
          webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
          iosUrlScheme: process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME,
          androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
        },
      ],
    ],
  },
};
