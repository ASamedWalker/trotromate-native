module.exports = {
  dependencies: {
    // Apple-Watch-only lib. Its Android "module" is an uncompilable template
    // stub (literally a `multiply` example) that breaks assembleRelease on
    // RN 0.81 — exclude it from Android autolinking. JS usage is already
    // Platform.OS === 'ios' guarded in lib/watchSync.ts.
    'react-native-watch-connectivity': {
      platforms: {
        android: null,
      },
    },
  },
};
