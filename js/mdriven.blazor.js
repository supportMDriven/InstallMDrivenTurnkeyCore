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

window.getCssVarMDriven = function (varname) {
  return getComputedStyle(document.documentElement).getPropertyValue(varname);
};


window.getCurrentPositionMDriven = async () => {
  const pos = await new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject);
  });
  return [pos.coords.longitude, pos.coords.latitude];
};

window.CopyToClipbookMDriven = (text) => {
  navigator.clipboard.writeText(text).then(function () {
    console.log('Copied to clipboard successfully!');
  }, function (err) {
    console.error('Could not copy text: ', err);
  });
};

window.ReadFromClipbookMDriven = async () => {
  try {
    const text = await navigator.clipboard.readText();
    console.log('Paste from clipboard!');
    return text;
  } catch (err) {
    console.error('Could not read text: ', err);
    return "";
  }
};


window.selectAllTextInElementMDriven = function (element) {
  element.select();
};

window.setOrRemoveClassInElementMDriven = function (element, classname, set) {
  if (set) {
    element.classList.add(classname);
  }
  else {
    element.classList.remove(classname);
  }
};

window.setOrRemoveClassInElementFromIdMDriven = function (idstr, classname, set) {
  const element = document.getElementById(idstr);
  if (element != null) {
    setOrRemoveClassInElementMDriven(element, classname, set);
  }
};

window.setElementFocusMDriven = function (elementId) {
  if (elementId === "") {
    let elem = document.activeElement;
    if (elem != null) {
      elem.blur(); // Remove focus from the currently active element, to apply edit
      elem.focus();
    }
  }
  else {
    const element = document.getElementById(elementId);
    if (element) {
      element.focus();
    }
  }

};

/* does not work
window.stopPropagationMDriven=function(event) {
  event.stopPropagation();
};
*/

/////////////// Column resize, does resize in % until last column is forcefully dragged of screen - then switch to px - stay on px as long as all columns sum to wider than outer div

// Observer of changes within the document
const observer = new MutationObserver(mutations => {
  mutations.forEach(mutation => {
    mutation.addedNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        // If node itself is '.col-header-content', check if it's inside 'table.quickgrid'
        if (node.matches('.col-header-content') && node.closest('table.quickgrid')) {
          insertDraggableButton(node.parentElement);
        }
        if (node.matches('.tk-data-table__native')) {
          if (window.TableKeyDownMDriven)
            window.TableKeyDownMDriven(node); //handle cellselect
        }
        if (node.matches('.seekeraction')) {
          if (window.IsSeekerMDriven)
            window.IsSeekerMDriven(node); //handle enter to search and ExcelPluginImport
        }

      }
    });
  });
});

// Start observing document changes
observer.observe(document.body, { childList: true, subtree: true });
document.addEventListener('keydown', function (event) {
  let theshortcut = '';
  // Check for 'Ctrl+S' or 'Cmd+S' (Mac) - we must do this in JS in order to prevent default
  if ((event.ctrlKey || event.metaKey)) {
    if (event.key === 's') {
      theshortcut = 'saveShortcut';
    }
    else if (event.key === 'e') {
      theshortcut = 'editShortcut';
    }
    else if (event.key === 'Enter') {
      theshortcut = 'saveAndLockShortcut';
    }
    else if (event.key === 'z') {
      theshortcut = 'undoShortcut';
    }
    else if (event.key === 'y') {
      theshortcut = 'redoShortcut';
    }
    else if (event.key === 'a') {
      const active = document.activeElement;
      const isInput = active && (
        active.tagName === 'INPUT' ||
        active.tagName === 'TEXTAREA');
      if (!isInput) {
        theshortcut = 'selectallfirsttable';
        var firsttable = document.querySelector('.tk-data-table__native');
        if (firsttable)
          SelectAllMDriven(firsttable, null);
      }
    }

  }
  else if (event.key === 'Escape') {
    theshortcut = 'cancelAndLockShortcut';
  }
  else if (event.altKey) {
    let firstMenuItem = document.querySelector('.tk-toolbar__button:first-child:not([disabled])');
    if (firstMenuItem === null) {
      firstMenuItem = document.querySelector('.tk-state-action:first-child:not([disabled])');
    }
    if (firstMenuItem === null || firstMenuItem == document.activeElement /*alt on toolbar should give menubar*/) {
      firstMenuItem = document.querySelector('.navbar__link:first-child');
    }
    if (firstMenuItem) {
      firstMenuItem.focus();
      event.preventDefault();
    }
  }

  if (theshortcut != '') {
    event.preventDefault();
    if (_dotnethelper) {
      _dotnethelper.invokeMethodAsync('OnShortcutKey', theshortcut);

    }
  }
});

// Inserts a draggable button into the given div
function insertDraggableButton(div) {
  const button = createDraggableButton();
  div.appendChild(button);
  button.onmousedown = handleMouseDown.bind(null, div);
}

// Creates and returns a draggable button element
function createDraggableButton() {
  const button = document.createElement('button');
  button.className = 'column-resizer';
  button.ondragstart = () => false;
  return button;
}

// Handles the mousedown event to either remove the width style or implement dragging logic
function handleMouseDown(div, e) {

  const th = div.closest('th');
  const table = th.closest('table');
  const startX = e.pageX;
  const startWidth = th.offsetWidth;

  // 1. Change to pixel widths temporarily for smooth dragging
  const allThs = table.querySelectorAll('th');
  allThs.forEach(header => {
    header.style.width = header.offsetWidth + 'px';
  });

  const onMouseMove = (e) => {
    const newWidth = startWidth + (e.pageX - startX);
    th.style.width = Math.max(newWidth, 50) + 'px';
  };

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);

    // 2. Convert all widths back to % once released
    const tableWidth = table.offsetWidth;
    allThs.forEach(header => {
      const widthInPercent = (header.offsetWidth / tableWidth) * 100;
      header.style.width = widthInPercent + '%';
    });
  };

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);


  
}


function setWidth(element, width) {
  element.style.width = width;
}


// ****************************
// Handle Timeout functionality
// ****************************


window.SetupTimeoutTimerToCheckIn1Minute = async () => {
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

