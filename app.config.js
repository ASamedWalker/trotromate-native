export default {
  expo: {
    name: "Troski",
    slug: "troski",
    version: "1.1.1",
    description: "Know your trotro fare, beat the queue. Community-powered transit updates for Ghana.",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "troski",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.troski.app",
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "Troski uses your location to show nearby stations, queue status, and to help plan routes from your current position.",
        NSLocationAlwaysAndWhenInUseUsageDescription: "Troski uses your location in the background during GO Mode to notify you when you're approaching your destination stop.",
        NSCameraUsageDescription: "Troski uses your camera to let you take photos of trotro queues, station conditions, or fare displays to share as Troski Tales with other commuters.",
        NSPhotoLibraryUsageDescription: "Troski accesses your photo library so you can select existing photos to attach to your Troski Tales posts — for example, a photo of a busy station queue or a trotro fare board.",
        NSPhotoLibraryAddUsageDescription: "Troski saves receipt images and fare screenshots to your photo library so you can keep a record of your transport expenses.",
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#f59e0b",
      },
      package: "com.troski.app",
      edgeToEdgeEnabled: true,
      permissions: [
        "android.permission.CAMERA",
        "android.permission.INTERNET",
        "android.permission.ACCESS_NETWORK_STATE",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.FOREGROUND_SERVICE_LOCATION",
      ],
      blockedPermissions: [
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.READ_MEDIA_VIDEO",
        "android.permission.READ_MEDIA_AUDIO",
      ],
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "expo-router",
      "expo-secure-store",
      "expo-font",
      [
        "expo-image-picker",
        {
          photosPermission: "Troski accesses your photo library so you can select existing photos to attach to your Troski Tales posts — for example, a photo of a busy station queue or a trotro fare board.",
          cameraPermission: "Troski uses your camera to let you take photos of trotro queues, station conditions, or fare displays to share as Troski Tales with other commuters.",
          androidImagePickerMode: "system",
        },
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/images/icon.png",
          color: "#f59e0b",
        },
      ],
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          resizeMode: "contain",
          backgroundColor: "#f59e0b",
        },
      ],
      [
        "@rnmapbox/maps",
        {
          RNMapboxMapsDownloadToken: process.env.MAPBOX_SECRET_TOKEN || "MAPBOX_SECRET_TOKEN",
        },
      ],
      "expo-video",
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "Troski uses your location in the background during GO Mode to notify you when you're approaching your destination stop.",
          locationWhenInUsePermission: "Troski uses your location to show nearby stations and guide you to your destination.",
          isAndroidBackgroundLocationEnabled: true,
          isAndroidForegroundServiceEnabled: true,
        },
      ],
      "./plugins/removeMediaPermissions",
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      eas: {
        projectId: "d62638cb-9c06-4aac-8e00-cbf7598ed47f",
      },
      router: {},
    },
    owner: "swalker01",
    runtimeVersion: {
      policy: "appVersion",
    },
    updates: {
      url: "https://u.expo.dev/d62638cb-9c06-4aac-8e00-cbf7598ed47f",
    },
  },
};
