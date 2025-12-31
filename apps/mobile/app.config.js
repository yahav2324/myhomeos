const path = require('path');

const asset = (p) => path.join(__dirname, p);

module.exports = {
  expo: {
    name: 'Mobile',
    slug: 'mobile',
    version: '1.0.0',
    orientation: 'portrait',

    icon: asset('assets/images/icon.png'),
    scheme: 'mobile',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,

    ios: { supportsTablet: true },

    android: {
      adaptiveIcon: {
        foregroundImage: asset('assets/images/adaptive-icon.png'),
        backgroundColor: '#ffffff',
      },
      edgeToEdgeEnabled: true,
      package: 'com.anonymous.mobile',
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
    ],
  },
};
