const { getDefaultConfig } = require("expo/metro-config");

// NativeWind v4 metro integration
// Using dynamic require to work around Windows ESM path issue
let withNativeWind;
try {
  withNativeWind = require("nativewind/metro").withNativeWind;
} catch (e) {
  // Fallback if nativewind/metro fails
  withNativeWind = null;
}

const config = getDefaultConfig(__dirname);

if (withNativeWind) {
  module.exports = withNativeWind(config, { input: "./global.css" });
} else {
  module.exports = config;
}
