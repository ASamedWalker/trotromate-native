/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: "watch-widget",
  name: "TroskiWatchWidget",
  displayName: "Troski Complications",
  bundleIdentifier: "com.troski.app.watch.widget",
  deploymentTarget: "10.0",
  frameworks: ["SwiftUI", "WidgetKit"],
  entitlements: {
    "com.apple.security.application-groups": ["group.com.troski.app"],
  },
};
