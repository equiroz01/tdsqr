const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withAndroidTVManifest(config) {
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults.manifest;

    // Add leanback feature (not required, so app works on both TV and mobile)
    if (!manifest['uses-feature']) {
      manifest['uses-feature'] = [];
    }

    // Check if leanback is already added
    const hasLeanback = manifest['uses-feature'].some(
      (feature) => feature.$?.['android:name'] === 'android.software.leanback'
    );

    if (!hasLeanback) {
      manifest['uses-feature'].push({
        $: {
          'android:name': 'android.software.leanback',
          'android:required': 'false',
        },
      });
    }

    // Make touchscreen not required (for TV compatibility)
    const hasTouchscreen = manifest['uses-feature'].some(
      (feature) => feature.$?.['android:name'] === 'android.hardware.touchscreen'
    );

    if (!hasTouchscreen) {
      manifest['uses-feature'].push({
        $: {
          'android:name': 'android.hardware.touchscreen',
          'android:required': 'false',
        },
      });
    }

    // Add LEANBACK_LAUNCHER category to main activity
    const application = manifest.application?.[0];
    if (application?.activity) {
      for (const activity of application.activity) {
        if (activity.$?.['android:name'] === '.MainActivity') {
          const intentFilters = activity['intent-filter'];
          if (intentFilters) {
            for (const filter of intentFilters) {
              // Check if this is the LAUNCHER intent filter
              const hasLauncher = filter.category?.some(
                (cat) => cat.$?.['android:name'] === 'android.intent.category.LAUNCHER'
              );

              if (hasLauncher) {
                // Add LEANBACK_LAUNCHER category
                const hasLeanbackLauncher = filter.category?.some(
                  (cat) => cat.$?.['android:name'] === 'android.intent.category.LEANBACK_LAUNCHER'
                );

                if (!hasLeanbackLauncher) {
                  filter.category.push({
                    $: {
                      'android:name': 'android.intent.category.LEANBACK_LAUNCHER',
                    },
                  });
                }
              }
            }
          }
        }
      }
    }

    // Add banner to application
    if (application) {
      application.$['android:banner'] = '@drawable/tv_banner';
    }

    return config;
  });
}

function withTVBanner(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const bannerSource = path.join(projectRoot, 'assets', 'tv-banner.png');
      const drawableDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res', 'drawable');

      // Create drawable directory if it doesn't exist
      if (!fs.existsSync(drawableDir)) {
        fs.mkdirSync(drawableDir, { recursive: true });
      }

      // Copy banner to drawable folder
      const bannerDest = path.join(drawableDir, 'tv_banner.png');
      if (fs.existsSync(bannerSource)) {
        fs.copyFileSync(bannerSource, bannerDest);
        console.log('✅ TV banner copied to drawable folder');
      } else {
        console.warn('⚠️ TV banner not found at:', bannerSource);
      }

      return config;
    },
  ]);
}

function withAndroidTV(config) {
  config = withAndroidTVManifest(config);
  config = withTVBanner(config);
  return config;
}

module.exports = withAndroidTV;
