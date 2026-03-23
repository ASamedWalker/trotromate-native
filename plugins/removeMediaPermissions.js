const {
  withAndroidManifest,
  withAppBuildGradle,
} = require('@expo/config-plugins')

module.exports = function removeMediaPermissions(config) {
  // Layer 1: Manifest-level — tools:node="remove" for the manifest merger
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest

    const blocked = [
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VIDEO',
      'android.permission.READ_MEDIA_AUDIO',
    ]

    const cappedAtSdk32 = [
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ]

    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = []
    }

    manifest['uses-permission'] = manifest['uses-permission'].filter(
      (perm) => !blocked.includes(perm.$['android:name'])
    )

    for (const perm of blocked) {
      manifest['uses-permission'].push({
        $: {
          'android:name': perm,
          'tools:node': 'remove',
        },
      })
    }

    for (const perm of cappedAtSdk32) {
      const existing = manifest['uses-permission'].find(
        (p) => p.$['android:name'] === perm
      )
      if (existing) {
        existing.$['android:maxSdkVersion'] = '32'
        existing.$['tools:replace'] = 'android:maxSdkVersion'
      }
    }

    if (!manifest.$['xmlns:tools']) {
      manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools'
    }

    return config
  })

  // Layer 2: Gradle — strip permissions from the final merged manifest.
  // Uses task outputs (AGP-version-agnostic) instead of hardcoded properties.
  config = withAppBuildGradle(config, (config) => {
    config.modResults.contents += `

// [removeMediaPermissions] Strip broad media permissions from final merged manifest.
afterEvaluate {
    android.applicationVariants.all { variant ->
        def taskName = "process\${variant.name.capitalize()}MainManifest"
        try {
            def mergeTask = tasks.getByName(taskName)
            mergeTask.doLast {
                it.outputs.files.asFileTree.matching {
                    include '**/AndroidManifest.xml'
                }.each { manifestFile ->
                    def content = manifestFile.text
                    ['READ_MEDIA_IMAGES', 'READ_MEDIA_VIDEO', 'READ_MEDIA_AUDIO'].each { perm ->
                        content = content.replaceAll(
                            '<uses-permission[^>]*android:name="android\\\\.permission\\\\.' + perm + '"[^/]*/>', ''
                        )
                    }
                    manifestFile.text = content
                    println "[removeMediaPermissions] Stripped READ_MEDIA_* from \${manifestFile.path}"
                }
            }
        } catch (Exception e) {
            println "[removeMediaPermissions] Warning: task \${taskName} not found: \${e.message}"
        }
    }
}
`
    return config
  })

  return config
}
