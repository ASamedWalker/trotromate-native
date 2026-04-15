/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: "watch",
  name: "TroskiWatch",
  displayName: "Troski",
  icon: "../../assets/images/icon.png",
  deploymentTarget: "10.0",
  frameworks: ["SwiftUI", "WatchConnectivity"],
  entitlements: {
    "com.apple.security.application-groups": ["group.com.troski.app"],
  },
};
