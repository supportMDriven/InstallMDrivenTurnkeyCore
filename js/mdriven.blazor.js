let _dotnethelper = null;
let _timeoutworker = null;
let _delayBeforeTimeout = 0;

function TheResizeCallback() {
  if (_dotnethelper) {
    _dotnethelper.invokeMethodAsync('OnResize', window.innerWidth, window.innerHeight);
  }
};

window.registerViewportChangeCallback = (dotnetHelper) => {
  _dotnethelper = dotnetHelper;
  window.addEventListener('resize', TheResizeCallback);
};

window.unRegisterViewportChangeCallback = function () {
  window.removeEventListener('resize', TheResizeCallback);
  _dotnethelper = null;
};


window.getDimensions = function () {
  return {
    width: window.innerWidth,
    height: window.innerHeight
  };
};

window.getBoundingClientRectMDriven = function (elementId) {
  let elem = document.getElementById(elementId);
  if (elem != null)
    return elem.getBoundingClientRect();
  return null;
};

window.setCssVarMDriven = function (varname, varvalue) {
  document.documentElement.style.setProperty(varname, varvalue);
};

window.getCurrentPositionMDriven = async () => {
  const pos = await new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject);
  });
  return [pos.coords.longitude, pos.coords.latitude];
};

  // ****************************
  // Handle Timeout functionality
  // ****************************


window.SetupTimeoutTimerToCheckIn1Minute=async ()=> {
  if (_timeoutworker)
    _timeoutworker.terminate();

  // Create WebWorker if browser supports it
  if (window.Worker) {
    _timeoutworker = new Worker('js/worker.js');
    _timeoutworker.postMessage([1]);
    _timeoutworker.onmessage = (e) => {
      _timeoutworker.terminate();
      _timeoutworker = null;
      if (_dotnethelper) {
        _dotnethelper.invokeMethodAsync('OnTimeout');
      }
    };

    _timeoutworker.onerror = (error) => {
      console.error('Worker error:', error);
      _timeoutworker.terminate();
      _timeoutworker = null;
    };
  }
}
