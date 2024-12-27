// aim is to implement CellSelect, copy and paste to and from excel, also handle multi item search, and import to replace Excel-plugin



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
      correcttarget = correcttarget.parentElement; // blazor
    }
    if (correcttarget.tagName == 'TD') {
      let thecurrentcell = correcttarget;
      let thecurrentrow = thecurrentcell.parentElement;
      let row = thecurrentrow.rowIndex - 1; // correct for header
      let col = thecurrentcell.cellIndex;

      if (event.shiftKey) {
        thetable._cellLast = thecurrentcell;
      }
      else {
        thetable._cellAnchor = thecurrentcell;
        thetable._cellLast = thecurrentcell;

      }

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
      thetable._cellLast = thecurrentcell;
      UpdateCellSelects(thetable, isBlazor);
    }
    event.preventDefault();
  });


  thetable.addEventListener('keydown', function (event) {
    const key = event.key;
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
          col = col < thecurrentrow.cells.length - 1 ? col + 1 : col;
          break;
        case 'V', 'v':
          if (event.ctrlKey) {
            let data = navigator.clipboard.readText().then((text) => {
              PossibleCellPasteMDriven(thetable, text, angularscope);
              return;
            });
          }
          break;
        case 'C', 'c':
          if (event.ctrlKey) {
            CopyDataToClipFromCellSelectMDriven(thetable, angularscope);
            event.preventDefault();
            return;
          }
          break;
        case 'A', 'a':
          if (event.ctrlKey) {
            SelectAllMDriven(thetable, angularscope);
            event.preventDefault();
            return;
          }
          break;
        case 'Enter': {
          const input = thecurrentcell.querySelector('input');
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
      if (correcttarget.tagName === 'TD') {
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

function SelectAllMDriven(thetable, angularscope) {
  if (!angularscope) {
    DotNet.invokeMethodAsync('MDriven.Components.WebAssembly', 'SelectAll', thetable).then(response => {
      console.log(response); // Outputs: Hello, Alice Johnson! 
    });
  }
  else {
    angularscope.$parent.selectAllRows(angularscope.$parent.root.VMClassId.VMClassName, angularscope.vcolName);
  }
}


function CopyDataToClipFromRowSelectMDriven(thetable, headerrowelement, angularscope) {
  console.log("CopyDataToClipFromRowSelectMDriven");

  if (!angularscope) {
    DotNet.invokeMethodAsync('MDriven.Components.WebAssembly', 'RowsToClip', thetable).then(response => {
      console.log(response); // Outputs: Hello, Alice Johnson! 
    });
  }
  else {
    let listofitems = angularscope.$parent.root[angularscope.vcolName];

    let isfirstrow = true;
    let copydataheader = '';
    let copydata = '';
    listofitems.forEach(listitem => {
      if (listitem.vCurrent || listitem.vSelected) {
        let isfirst = true;
        let rowdata = '';
        Array.from(headerrowelement.children).forEach(header => {

          if (header.attributes.colname) {
            let membername = header.attributes.colname.value;
            let memberitem = listitem[membername];
            if (isfirstrow) {
              if (!isfirst)
                copydataheader += '\t';
              copydataheader += membername;
            }

            if (!isfirst)
              rowdata += '\t';
            rowdata += memberitem;
            isfirst = false;

          }

        });
        if (!isfirstrow)
          copydata += '\r\n';
        copydata += rowdata;
        isfirstrow = false;
      }

    });
    if (!isfirstrow) {
      let tot = copydataheader + '\r\n' + copydata;
      angularscope.$parent.ViewData.RootVMClassObject["VM_Variables"]["vClipbookData"] = tot;
      angularscope.$parent.$broadcast('__vClipbookDataChanged');
    }
  }
}


function PossibleCellPasteMDriven(thetable, text, angularscope) {

  if (thetable._cellAnchor) {
    const rows = text.split('\r\n');

    rows.forEach((row, rowIndex) => {
      const cells = row.split('\t');
      if (cells != "") {
        cells.forEach((cell, cellIndex) => {
          let inp = thetable.rows[rowIndex + thetable._cellAnchor.parentElement.rowIndex].cells[cellIndex + thetable._cellAnchor.cellIndex].querySelector('input');
          if (inp && (inp.disabled == nothing || disabled != 'disabled')) {
            if (inp.type == "date") {
              const cellasdate = new Date(cell);
              const year = cellasdate.getFullYear();
              const month = String(cellasdate.getMonth() + 1).padStart(2, '0'); // Months are zero-based
              const day = String(cellasdate.getDate()).padStart(2, '0');
              cell = `${year}-${month}-${day}`;
            }
            inp.value = cell;
            if (angularscope) {
              const event = new Event('input', { bubbles: true });
              inp.dispatchEvent(event);  // to touch it like a user so that angular sees it
            }
          }
        });
      }
    });

  }
}

function PossibleExcelPluginActionMDriven(text, angularscope) {
  if (!angularscope) {
  } else {
    angularscope.$parent.ViewClient.StreamingAppClient.ExcelPluginDataSend(angularscope.$parent.ViewClient.ViewData.VMId, text).then(() => { });
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
  let headerrowelement = thetable.querySelector('thead').querySelector('tr');
  if (minRow == maxRow && minCol == maxCol) {
    CopyDataToClipFromRowSelectMDriven(thetable, headerrowelement, angularscope);
    return;
  }

  if (!angularscope) {
    DotNet.invokeMethodAsync('MDriven.Components.WebAssembly', 'CellsToClip', thetable, minCol, MaxCol, minRow, MaxCol).then(response => {
      console.log(response); // Outputs: Hello, Alice Johnson! 
    });
    return;
  }


  let isfirstrow = true;
  let clipdata = '';
  for (var i = minRow; i <= maxRow; i++) {
    let cellelem = body.rows[i];
    let rowhasdata = false;
    let isfirst = true;
    let rowdata = '';



    let angularelement = angular.element(cellelem);
    if (angularelement) {
      let listitem = angularelement.scope().row;
      for (var x = minCol; x <= maxCol; x++) {
        let membername = headerrowelement.children[x].attributes.colname.value;
        let memberitem = listitem[membername];
        if (memberitem && memberitem != '')
          rowhasdata = true;
        if (!isfirst)
          rowdata += '\t';
        if (memberitem) {
          if (memberitem instanceof Date) {
            const year = memberitem.getFullYear();
            const month = String(memberitem.getMonth() + 1).padStart(2, '0'); // Months are zero-based
            const day = String(memberitem.getDate()).padStart(2, '0');
            const hours = String(memberitem.getHours()).padStart(2, '0');
            const minutes = String(memberitem.getMinutes()).padStart(2, '0');
            memberitem = `${year}-${month}-${day} ${hours}:${minutes}`;
          }
          rowdata += memberitem;
        }
        isfirst = false;
      }

    }
    if (rowhasdata) {
      if (!isfirstrow)
        clipdata += '\r\n';
      clipdata += rowdata;
      isfirstrow = false;
    }




  }
  angularscope.$parent.ViewData.RootVMClassObject["VM_Variables"]["vClipbookData"] = clipdata;
  angularscope.$parent.$broadcast('__vClipbookDataChanged');

}


function UpdateCellSelects(thetable, isBlazor) {

  // Mouse move sends a lot even if in same cell
  if (thetable._lastAnchor != thetable._cellAnchor || thetable._lastLast != thetable._cellLast) {

    if (thetable._lastLast == null)
      thetable._lastLast = thetable._lastAnchor;

    const effectedelements = [];
    const effectedelementsborder = [];



    if (thetable._lastAnchor != null) {
      let square = getSquareSelection(thetable._lastAnchor, thetable._lastLast);
      let body = thetable._lastAnchor.parentElement.parentElement;
      square.forEach(cell => {
        let cellelem = body.rows[cell.row].cells[cell.col];
        let elementtostyle = cellelem;
        if (isBlazor) {
          elementtostyle = cellelem.children[0];
        }
        else {
        }
        effectedelements.push(elementtostyle);
        effectedelementsborder.push(cellelem);
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

        effectedelements.push(elementtostyle);
        effectedelementsborder.push(cellelem);
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




    thetable._lastAnchor = thetable._cellAnchor;
    thetable._lastLast = thetable._cellLast;

    console.log("UpdateCellSelects rem:" + countremoved + " add:" + countadded + " blazor:" + isBlazor);
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



///////CELL SELECT END

