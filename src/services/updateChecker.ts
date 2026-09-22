import { APP_VERSION, GITHUB_REPO } from '../constants/version';

/**
 * Metadata payload for an available application update.
 */
export type UpdateInfo = {
  isAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseName: string;
  releaseNotes?: string;
  downloadUrl: string;
  releaseUrl: string;
};

/**
 * Compare two semver strings (e.g. "1.0.0" vs "1.0.1").
 * Returns:
 *   1 if v1 > v2
 *  -1 if v1 < v2
 *   0 if equal
 */
export function compareVersions(v1: string, v2: string): number {
  try {
    const clean1 = (v1 ?? '').replace(/^v/i, '').trim();
    const clean2 = (v2 ?? '').replace(/^v/i, '').trim();

    const parts1 = clean1.split('.').map((p) => parseInt(p, 10) || 0);
    const parts2 = clean2.split('.').map((p) => parseInt(p, 10) || 0);

    const length = Math.max(parts1.length, parts2.length);
    for (let i = 0; i < length; i++) {
      const num1 = parts1[i] ?? 0;
      const num2 = parts2[i] ?? 0;
      if (num1 > num2) return 1;
      if (num1 < num2) return -1;
    }
    return 0;
  } catch (err: unknown) {
    console.warn('[UpdateChecker] compareVersions failed:', err);
    return 0;
  }
}

/**
 * Check GitHub Releases API for the latest published release.
 * Fails safely and silently if network is offline or no releases exist,
 * ensuring zero degradation to core payment functionality.
 *
 * @returns UpdateInfo if a newer release exists, or null.
 */
export async function checkForAppUpdate(): Promise<UpdateInfo | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      try {
        controller.abort();
      } catch {
        // Prevent abort from throwing
      }
    }, 4000);

    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'NoFeePe-App',
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!res?.ok) {
      // 404 indicates no releases published yet; other codes mean rate limit or network issue
      return null;
    }

    const data = await res.json();
    if (!data?.tag_name) return null;

    const rawTag = String(data.tag_name).trim();
    const latestVersion = rawTag.replace(/^v/i, '');
    const isNewer = compareVersions(latestVersion, APP_VERSION) > 0;

    if (!isNewer) return null;

    // Look for a precompiled APK asset in the release
    let downloadUrl = data?.html_url ?? `https://github.com/${GITHUB_REPO}/releases`;
    if (Array.isArray(data?.assets) && data.assets.length > 0) {
      const apkAsset = data.assets.find(
        (a: { name?: string; browser_download_url?: string }) =>
          typeof a?.name === 'string' && a.name.toLowerCase().endsWith('.apk')
      );
      if (apkAsset?.browser_download_url) {
        downloadUrl = apkAsset.browser_download_url;
      }
    }

    return {
      isAvailable: true,
      currentVersion: APP_VERSION,
      latestVersion,
      releaseName: data?.name ?? `Version ${latestVersion}`,
      releaseNotes: data?.body ? String(data.body).slice(0, 300) : undefined,
      downloadUrl,
      releaseUrl: data?.html_url ?? `https://github.com/${GITHUB_REPO}/releases`,
    };
  } catch (err: unknown) {
    // Network offline or timeout: fail silently to preserve offline payment functionality
    console.debug?.('[UpdateChecker] Offline or update check timeout:', err);
    return null;
  }
}
