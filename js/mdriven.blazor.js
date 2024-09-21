let _dotnethelper = null;

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