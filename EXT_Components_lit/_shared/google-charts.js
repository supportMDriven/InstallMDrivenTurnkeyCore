const loaderUrl = "https://www.gstatic.com/charts/loader.js";

let loaderPromise;
let packageQueue = Promise.resolve();
const packagePromises = new Map();

function loadScript() {
  if (globalThis.google?.charts?.load) {
    return Promise.resolve(globalThis.google);
  }
  if (loaderPromise) {
    return loaderPromise;
  }

  loaderPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${loaderUrl}"]`);
    const script = existing ?? document.createElement("script");
    const onLoad = () => {
      if (!globalThis.google?.charts?.load) {
        reject(new Error("Google Charts loader loaded without its API."));
        return;
      }
      resolve(globalThis.google);
    };
    const onError = () => reject(new Error(`Failed to load Google Charts from ${loaderUrl}.`));

    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });
    if (!existing) {
      script.src = loaderUrl;
      script.async = true;
      document.head.append(script);
    } else if (globalThis.google?.charts?.load) {
      onLoad();
    }
  }).catch(error => {
    loaderPromise = undefined;
    throw error;
  });

  return loaderPromise;
}

export async function loadGoogleCharts(packageName) {
  const google = await loadScript();
  if (!packagePromises.has(packageName)) {
    const loading = packageQueue.then(() => {
      const result = google.charts.load("current", { packages: [packageName] });
      return result && typeof result.then === "function"
        ? result
        : new Promise(resolve => google.charts.setOnLoadCallback(resolve));
    });
    packagePromises.set(packageName, loading);
    packageQueue = loading.catch(() => undefined);
    loading.catch(() => packagePromises.delete(packageName));
  }
  await packagePromises.get(packageName);
  return google;
}
