// aim is to implement CellSelect, copy and paste to and from excel, also handle multi item search, and import to replace Excel-plugin


window.IsSeekerMDriven = function (theMainSeekerButton) { //handle enter to search and ExcelPluginImport for Blazor
  document.body.removeEventListener('keydown', checkSeekerForEnterAndExcelPasteKeyDown);
  document.body.addEventListener('keydown', checkSeekerForEnterAndExcelPasteKeyDown);
}



//////////CELL SELECT
window.TableKeyDownMDriven = function (thetable, angularscope) {
  thetable._cellAnchor = null;
  thetable._cellLast = null;

  thetable.addEventListener('mousedown', function (event) {
    let correcttarget = event.target;
    let isBlazor = window.hasOwnProperty('Blazor');
    if (correcttarget.tagName != 'TD') {
      while (correcttarget && !(correcttarget.tagName === 'DIV' && correcttarget.parentElement && correcttarget.parentElement.tagName === 'TD')) {
        correcttarget = correcttarget.parentElement; // Move to the parent element 
      }
      if (!correcttarget)
        return; // click in header so we never find TD
      correcttarget = correcttarget.parentElement; // blazor
    }
    if (correcttarget.tagName == 'TD') {
      let thecurrentcell = correcttarget;
      let thecurrentrow = thecurrentcell.parentElement;
      let row = thecurrentrow.rowIndex - 1; // correct for header
      let col = thecurrentcell.cellIndex;
      if (thecurrentrow.rowIndex == -1) {
        //something fishy
      }
      MarkFirstVisibleCell(thecurrentrow); // added to allow current row marker to show even when first cell is hidden in angular


      if (event.shiftKey) {
        thetable._cellLast = thecurrentcell;
      }
      else {
        thetable._cellAnchor = thecurrentcell;
        thetable._cellLast = thecurrentcell;

      }
      if (thetable._lastAnchor != null && thetable._lastAnchor.parentElement != null && thetable._lastAnchor.parentElement.parentElement == null) // if its a TD not belonging to a table
        thetable._lastAnchor = null;
      if (thetable._lastLast != null && thetable._lastLast.parentElement != null && thetable._lastLast.parentElement.parentElement == null) // if its a TD not belonging to a table
        thetable._lastLast = null;

      UpdateCellSelects(thetable, isBlazor);
      thetable._mousedown = true;

    }

  });
  thetable.addEventListener('mouseup', function (event) {
    thetable._mousedown = false;
  });


  thetable.addEventListener('mousemove', function (event) {
    let correcttarget = event.target;
    let isBlazor = window.hasOwnProperty('Blazor');
    if (event.target.tagName == 'DIV' && event.target.parentElement.tagName == 'TD') {
      correcttarget = event.target.parentElement; // blazor
    }
    if (correcttarget.tagName == 'TD' && thetable._mousedown == true) {
      let thecurrentcell = correcttarget;
      if (thecurrentcell && thecurrentcell.classList.contains('tk-data-table__cell--context'))
        return; // this is row contextmenu that is implemented as an extra cell in angular

      thetable._cellLast = thecurrentcell;
      UpdateCellSelects(thetable, isBlazor);
    }
    event.preventDefault();
  });


  thetable.addEventListener('keydown', function (event) {
    const key = event.key;
    if (event.defaultPrevented)
      return;

    // in angular the cell is the td 
    const activeElement = document.activeElement;
    if (activeElement == null)
      return;
    let isBlazor = window.hasOwnProperty('Blazor');
    let correcttarget = activeElement;
    if (activeElement.tagName == 'DIV' && activeElement.parentElement.tagName == 'TD') {
      correcttarget = activeElement.parentElement; // blazor
    }


    if (correcttarget.tagName === 'TD') {
      let thecurrentcell = correcttarget;
      let thecurrentrow = correcttarget.parentElement;
      let row = thecurrentrow.rowIndex - 1; // correct for header
      let col = thecurrentcell.cellIndex;
      let colCountTakenfromheadertoavoidextracells = thetable.querySelector('thead').rows[0].cells.length;

      switch (key) {
        case 'ArrowUp':
          row = row > 0 ? row - 1 : row;
          break;
        case 'ArrowDown':
          row = row < thecurrentrow.parentElement.rows.length - 1 ? row + 1 : row;
          break;
        case 'ArrowLeft':
          col = col > 0 ? col - 1 : col;
          break;
        case 'ArrowRight':
          col = col < colCountTakenfromheadertoavoidextracells - 1 ? col + 1 : col;
          break;
        case 'V':
        case 'v':
          if (event.ctrlKey) {
            let data = navigator.clipboard.readText().then((text) => {
              PossibleCellPasteMDriven(thetable, text, angularscope);
              return;
            });
          }
          break;
        case 'C':
        case 'c':
          if (event.ctrlKey) {
            CopyDataToClipFromCellSelectMDriven(thetable, angularscope);
            event.preventDefault();
            return;
          }
          break;
        case 'A':
        case 'a':
          if (event.ctrlKey) {
            if (thecurrentcell.tagName == 'DIV' || thecurrentcell.tagName == 'TD') {
              SelectAllMDriven(thetable, angularscope);


              event.preventDefault();
            }
            return; // controls have their own select-all
          }
          break;
        case 'Enter': {
          const input = thecurrentcell.querySelector('input,select');
          if (input) {
            input.focus();
            return;
          }
          break;
        }
        default:
          return; // Quit when this doesn't handle the key event.
      }

      console.log(row + ' ' + col);
      const nextCell = thecurrentrow.parentElement.rows[row].cells[col];
      if (event.shiftKey) {
        thetable._cellLast = nextCell;
      }
      else {
        thetable._cellAnchor = nextCell;
        thetable._cellLast = nextCell;
      }
      UpdateCellSelects(thetable, isBlazor);
      if (isBlazor)
        nextCell.children[0].focus();
      else
        nextCell.focus();
      event.preventDefault();

    }
    else {
      // paste in header 
      if (correcttarget.tagName === 'TH') {
        switch (key) {
          case 'V', 'v':
            if (event.ctrlKey) {
              let data = navigator.clipboard.readText().then((text) => {
                PossibleExcelPluginActionMDriven(text, angularscope);
              });
            }
            break;
          default:
            return; // Quit when this doesn't handle the key event.
        }
      }
    }



  });

}

function isInsideTable(element) {
  while (element) {
    if (element.tagName === 'TABLE') {
      return true;
    }
    element = element.parentElement;
  }
  return false;
}
function checkSeekerForEnterAndExcelPasteKeyDown(event) {

  const key = event.key;
  if (event.defaultPrevented)
    return;

  switch (key) {
    case 'V', 'v':
      if (event.ctrlKey) {
        if (event.activeElement) {
          if (event.activeElement.tagName != 'DIV') {
            return; // inputs have their own paste
          }
        }
        let theseekerbutton = document.body.querySelector('.seekeraction');
        if (theseekerbutton) {
          let data = navigator.clipboard.readText().then((text) => {
            DotNet.invokeMethodAsync('MDriven.Components.WebAssembly', 'ExcelPluginDataSend', text).then(response => {
              console.log(response);
            });
            return;
          });
        }
      }
      break;
    case 'Enter': {

      if (event.activeElement && isInsideTable(event.activeElement)) {
        return;// avoid triggering search if we are in table, enters mean different things in a table
      }
      let theseekerbutton = document.body.querySelector('.seekeraction');
      if (theseekerbutton) {
        theseekerbutton.focus(); // If input box has focus, need to move out to send search text
        theseekerbutton.click();
        event.stopPropagation();
        event.preventDefault();
      }

      break;
    }
    default:
      return; // Quit when this doesn't handle the key event.
  }
}

function SelectAllMDriven(thetable, angularscope) {
  if (!angularscope) {
    DotNet.invokeMethodAsync('MDriven.Components.WebAssembly', 'SelectAll', thetable.id).then(response => {
      console.log(response);
    });
  }
  else {
    angularscope.$parent.selectAllRows(angularscope.vclassName, angularscope.vcolName);
  }

  // also select all via cellselect to make it work even if mdriven is not multiselect in this case
  if (thetable.rows.length > 1) {
    thetable._cellAnchor = thetable.rows[1].cells[0]; // avoid header
    let colCountTakenfromheadertoavoidextracells = thetable.querySelector('thead').rows[0].cells.length;
    thetable._cellLast = thetable.rows[thetable.rows.length - 1].cells[colCountTakenfromheadertoavoidextracells - 1];;
    UpdateCellSelects(thetable, !angularscope);
  }

}




function PossibleCellPasteMDriven(thetable, text, angularscope) {

  if (thetable._cellAnchor) {
    const rows = text.split('\r\n');

    rows.forEach((row, rowIndex) => {
      const cells = row.split('\t');
      if (cells != "") {
        cells.forEach((cell, cellIndex) => {
          let inp = thetable.rows[rowIndex + thetable._cellAnchor.parentElement.rowIndex].cells[cellIndex + thetable._cellAnchor.cellIndex].querySelector('input,select');
          if (inp && (!inp.disabled) && (inp.disabled !== 'disabled')) {
            if (inp.tagName == "SELECT") {
              for (let i = 0; i < inp.options.length; i++) {
                if (inp.options[i].textContent === cell) {
                  inp.selectedIndex = i;
                  break;
                }
              }
            }
            else {
              if (inp.type == "date") {
                const cellasdate = new Date(cell);
                const year = cellasdate.getFullYear();
                const month = String(cellasdate.getMonth() + 1).padStart(2, '0'); // Months are zero-based
                const day = String(cellasdate.getDate()).padStart(2, '0');
                cell = `${year}-${month}-${day}`;
              }
              else if (inp.type == "checkbox") {
                if (cell && cell.toLowerCase() == 'true')
                  inp.checked = true;
                else
                  inp.checked = false;
              }
              inp.value = cell;
            }

            if (inp.tagName == "SELECT") {
              const event = new Event('change', { bubbles: true });
              inp.dispatchEvent(event);  // to touch it like a user so that angular and blazor sees it
            }
            else {
              const event = new Event('input', { bubbles: true });
              inp.dispatchEvent(event);  // to touch it like a user so that angular and blazor sees it
            }

          }
        });
      }
    });

  }
}


window.PossibleExcelPluginActionMDrivenTakeFromClip = function (angularscope) {
  let data = navigator.clipboard.readText().then((text) => {
    PossibleExcelPluginActionMDriven(text, angularscope);
  });
}

function PossibleExcelPluginActionMDriven(text, angularscope) {
  if (!angularscope) {
    DotNet.invokeMethodAsync('MDriven.Components.WebAssembly', 'ExcelPluginDataSend',  text).then(response => {
      console.log(response);
    });
  } else {
    angularscope.$parent.ViewClient.StreamingAppClient.ExcelPluginDataSend(angularscope.$parent.ViewClient.ViewData.VMId, text);
  }
}

function CopyDataToClipFromCellSelectMDriven(thetable, angularscope) {

  console.log("CopyDataToClipFromCellSelectMDriven");
  if (thetable._lastAnchor == null)
    return;
  if (thetable._lastLast == null)
    thetable._lastLast = thetable._lastAnchor;

  const minRow = Math.min(thetable._lastAnchor.parentElement.rowIndex - 1, thetable._lastLast.parentElement.rowIndex - 1);
  const maxRow = Math.max(thetable._lastAnchor.parentElement.rowIndex - 1, thetable._lastLast.parentElement.rowIndex - 1);
  const minCol = Math.min(thetable._lastAnchor.cellIndex, thetable._lastLast.cellIndex);
  const maxCol = Math.max(thetable._lastAnchor.cellIndex, thetable._lastLast.cellIndex);

  let body = thetable._lastAnchor.parentElement.parentElement;
  if (!body)
    return;

  let clipdata = '';

  // SHould header be included, yes if copy is all cells
  let headerrows = thetable.querySelector('thead').rows;
  if (headerrows.length == 1 && minCol == 0 && maxCol >= headerrows[0].cells.length - 1) {
    clipdata = GetCellsFromList(headerrows, 0, 0, minCol, headerrows[0].cells.length - 1) + '\r\n';
  }

  clipdata += GetCellsFromList(body.rows, minRow, maxRow, minCol, maxCol);
  clipdata = clipdata.replace(/\u00A0/g, ' '); // replace the nbsp(non breaking space - or Excel will get confused)

  if (!angularscope) {
    DotNet.invokeMethodAsync('MDriven.Components.WebAssembly', 'CellsToClip', thetable.id, clipdata).then(response => {
      console.log(response);
    });
    return;
  }
  else {
    angularscope.$parent.ViewData.RootVMClassObject["VM_Variables"]["vClipbookData"] = clipdata;
    angularscope.$parent.$broadcast('__vClipbookDataChanged');
  }

}

function GetCellsFromList(listtoiterate, minRow, maxRow, minCol, maxCol) {
  let isfirstrow = true;
  let clipdata = '';
  if (minCol == 0 && listtoiterate[minRow].cells[0].classList.contains('multiselectcol'))
    minCol = 1; // Avoid the multiselect checkbox in clip
  for (let y = minRow; y <= maxRow; y++) {
    let rowhasdata = false;
    let isfirst = true;
    let rowdata = '';
    const cells = listtoiterate[y].cells;
    for (let x = minCol; x <= maxCol; x++) {
      const inputElement = cells[x].querySelector('input,select');
      let cellContent = '';
      if (inputElement && inputElement.tagName == "SELECT") {
        cellContent = inputElement.options[inputElement.selectedIndex].textContent;
      }
      else {
        if (inputElement) {
          if (inputElement.type == "checkbox") {
            if (inputElement.checked)
              cellContent = "true";
            else
              cellContent = "false";
          }
          else
            cellContent = inputElement.value; // Get value of date input
        }
        else {
          cellContent = cells[x].innerText;
        }
      }
      if (cellContent && cellContent != '')
        rowhasdata = true;
      if (!isfirst)
        rowdata += '\t';
      if (cellContent && cellContent != '')
        rowdata += cellContent;
      isfirst = false;

      console.log(`Cell [${x}, ${y}]:` + cellContent);
    }

    if (rowhasdata) {
      if (!isfirstrow)
        clipdata += '\r\n';
      clipdata += rowdata;
      isfirstrow = false;
    }
  }
  return clipdata;
}

let _theLastKnownCellSelectTableMDriven = null;

function MarkFirstVisibleCell(thecurrentrow) {
  let firstVisible = Array.from(thecurrentrow.children).find(
    (el) => el.getAttribute("aria-hidden") !== "true"
  );
  if (!firstVisible)
    firstVisible = thecurrentrow.children.length > 0 ? thecurrentrow.children[0] : null;
  if (firstVisible) {
    Array.from(thecurrentrow.children).forEach(cell =>
      cell.classList.remove("firstvisiblecolumn")
    );
    firstVisible.classList.add("firstvisiblecolumn");
  }

}

function CheckSelectSums(thetable,countOFNumbers, sumOFNumbers) {
  const target = thetable.parentElement.parentElement.querySelector('.CellSelectInfo');
  if (target) {
    if (countOFNumbers > 1 && sumOFNumbers>0) {
      target.style.display = 'block';
      target.innerText = "sum: " + sumOFNumbers.toFixed(2) + " avg:" + (sumOFNumbers / countOFNumbers).toFixed(2) + " count:" + countOFNumbers.toFixed(0); 
    }
    else {
      target.style.display = 'none';
    }

  }
}

function GetNumberFromElement(element) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_ELEMENT, null, false);

  while (walker.nextNode()) {
    const el = walker.currentNode;
    const attr = el.getAttribute('numericvalue');
    if (attr !== null) {
      // Parse using invariant culture: dot as decimal separator
      const parsed = parseFloat(attr);
      return isNaN(parsed) ? null : parsed;
    }
  }

  return null; // Not found
}
function UpdateCellSelects(thetable, isBlazor) {

  if (_theLastKnownCellSelectTableMDriven && _theLastKnownCellSelectTableMDriven != thetable) {
    MDrivenClearCellSelectFromThis(_theLastKnownCellSelectTableMDriven); // only one table on the screen should show cell-select
  }
  _theLastKnownCellSelectTableMDriven = thetable;
  // Mouse move sends a lot even if in same cell
  if (thetable._lastAnchor != thetable._cellAnchor || thetable._lastLast != thetable._cellLast) {

    if (thetable._lastLast == null)
      thetable._lastLast = thetable._lastAnchor;

    //const effectedelements = [];
    const effectedelements = new Set();
    //const effectedelementsborder = [];
    const effectedelementsborder = new Set();
    let sumOFNumbers = 0.0;
    let countOFNumbers = 0;



    if (thetable._lastAnchor != null) {
      let square = getSquareSelection(thetable._lastAnchor, thetable._lastLast);
      let body = thetable._lastAnchor.parentElement.parentElement;
      if (!body)
        return;
      square.forEach(cell => {
        let cellelem = body.rows[cell.row].cells[cell.col];
        let elementtostyle = cellelem;
        if (isBlazor) {
          elementtostyle = cellelem.children[0];
        }
        else {
        }
        effectedelements.add(elementtostyle);
        effectedelementsborder.add(cellelem);
        elementtostyle._cellselectstate = 'off';
        elementtostyle._debug = '{' + cell.col + ';' + cell.row + '} ';
        cellelem._cellselectstate = 'off';

      });
    }


    if (thetable._cellLast == null)
      thetable._cellLast = thetable._cellAnchor;

    if (thetable._cellAnchor != null) {
      let square = getSquareSelection(thetable._cellAnchor, thetable._cellLast);
      let body = thetable._cellAnchor.parentElement.parentElement;
      square.forEach(cell => {
        let cellelem = body.rows[cell.row].cells[cell.col];
        let elementtostyle = cellelem;
        if (isBlazor) {
          elementtostyle = cellelem.children[0];
        }
        else {
        }

        effectedelements.add(elementtostyle);
        effectedelementsborder.add(cellelem);
        elementtostyle._cellselectstate = 'on'
        elementtostyle._debug = '{' + cell.col + ';' + cell.row + '} ';
        cellelem._cellselectstate = 'on'
        cellelem._bbottom = cell._bbottom;
        cellelem._bleft = cell._bleft;
        cellelem._btop = cell._btop;
        cellelem._bright = cell._bright;

      });
    }

    let countremoved = '';
    let countadded = '';
    effectedelements.forEach(elemToStyle => {
      if (elemToStyle._cellselectstate == "on") {

        if (isBlazor && elemToStyle.classList.contains("numeric")) {
          countOFNumbers++;
          sumOFNumbers += GetNumberFromElement(elemToStyle);
        }


        elemToStyle.classList.add('cellselect');
        countadded += elemToStyle._debug;
      }
      else {
        elemToStyle.classList.remove('cellselect');
        countremoved += elemToStyle._debug;
      }
    });

    effectedelementsborder.forEach(elemToStyle => {
      if (elemToStyle._cellselectstate == "on") {        
        if (elemToStyle._btop)
          elemToStyle.classList.add('cellselect_top');
        else
          elemToStyle.classList.remove('cellselect_top');
        if (elemToStyle._bleft)
          elemToStyle.classList.add('cellselect_left');
        else
          elemToStyle.classList.remove('cellselect_left');
        if (elemToStyle._bright)
          elemToStyle.classList.add('cellselect_right');
        else
          elemToStyle.classList.remove('cellselect_right');
        if (elemToStyle._bbottom)
          elemToStyle.classList.add('cellselect_bottom');
        else
          elemToStyle.classList.remove('cellselect_bottom');


      }
      else {
        elemToStyle.classList.remove('cellselect_top');
        elemToStyle.classList.remove('cellselect_left');
        elemToStyle.classList.remove('cellselect_right');
        elemToStyle.classList.remove('cellselect_bottom');
      }
    });



    CheckSelectSums(thetable,countOFNumbers, sumOFNumbers);
    thetable._lastAnchor = thetable._cellAnchor;
    thetable._lastLast = thetable._cellLast;

    //console.log("UpdateCellSelects rem:" + countremoved + " add:" + countadded + " blazor:" + isBlazor);
  }
}


let selectedCells = [];
class Cell { constructor(row, col, bleft, btop, bright, bbottom) { this.row = row; this.col = col; this._bleft = bleft; this._btop = btop; this._bright = bright; this._bbottom = bbottom; } }

function getSquareSelection(cell1, cell2) {
  const minRow = Math.min(cell1.parentElement.rowIndex - 1, cell2.parentElement.rowIndex - 1);
  const maxRow = Math.max(cell1.parentElement.rowIndex - 1, cell2.parentElement.rowIndex - 1);
  const minCol = Math.min(cell1.cellIndex, cell2.cellIndex);
  const maxCol = Math.max(cell1.cellIndex, cell2.cellIndex);

  const selection = [];
  let bleft = 0; let btop = 0; let bright = 0; let bbottom = 0;
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      selection.push(new Cell(row, col, col == minCol, row == minRow, col == maxCol, row == maxRow));
    }
  }
  return selection;
}

function findDifference(oldSelection, newSelection) {
  const oldSet = new Set(oldSelection.map(cell => `${cell.row},${cell.col}`));
  const newSet = new Set(newSelection.map(cell => `${cell.row},${cell.col}`));

  const deselected = oldSelection.filter(cell => !newSet.has(`${cell.row},${cell.col}`));
  const selected = newSelection.filter(cell => !oldSet.has(`${cell.row},${cell.col}`));

  return { deselected, selected };
}

function updateSelection(newSelection) {
  const { deselected, selected } = findDifference(selectedCells, newSelection);

  deselected.forEach(cell => {
    const td = document.querySelector(`tr:nth-child(${cell.row + 1}) td:nth-child(${cell.col + 1})`);
    td.classList.remove('selected');
  });

  selected.forEach(cell => {
    const td = document.querySelector(`tr:nth-child(${cell.row + 1}) td:nth-child(${cell.col + 1})`);
    td.classList.add('selected');
  });

  selectedCells = newSelection;
}

function MDrivenClearCellSelectFromThis(table) {
  if (table && table.tagName == 'TABLE') {
    for (let i = 0; i < table.rows.length; i++) {
      let row = table.rows[i];
      for (let j = 0; j < row.cells.length; j++) {
        let cell = row.cells[j];
        cell.classList.remove('cellselect');
        if (cell.children.length > 0)
          cell.children[0].classList.remove('cellselect'); // in blazor cell content has the cellselect 
        cell.classList.remove('cellselect_top');
        cell.classList.remove('cellselect_left');
        cell.classList.remove('cellselect_bottom');
        cell.classList.remove('cellselect_right');
      }
    }
  }

}

function MDrivenCellSelectClear(element) {
  console.log("MDrivenCellSelectClear");
  if (!element)
    return;
  let isBlazor = window.hasOwnProperty('Blazor');
  let table = null;
  if (isBlazor) {
    // in blazor the element is outside the table
    table = element.children[0];
  }
  else {
    // in angularjs the element is a child of the table
    while (element && element.tagName != 'TABLE') {
      element = element.parentElement;
    }
    if (element)
      table = element;
  }

  MDrivenClearCellSelectFromThis(table);

}

///////CELL SELECT END


//// ClientScriptExecute
function MDrivenClientScriptExecute(thescriptref) {
  // Use RegExp to extract function name and parameter
  const match = thescriptref.match(/^(\w+)\s*\(\s*"([^"]*)"\s*\)$/);

  if (match) {
    const functionName = match[1];
    const parameter = match[2];

    console.log("Function name:", functionName);
    console.log("Parameter:", parameter);

    if (typeof window[functionName] === "function") {
      console.log('MDrivenClientScriptExecute  ' + functionName);
      window[functionName](parameter);
    }
    else
      console.log('MDrivenClientScriptExecute  Script not found ' + thescriptref);
  }
  else 
    console.log('MDrivenClientScriptExecute  Script did not match regexp ' + thescriptref);

}
/// ClientScriptExecute end
