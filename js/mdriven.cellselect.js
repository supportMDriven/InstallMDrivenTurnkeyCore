// aim is to implement CellSelect, copy and paste to and from excel, also handle multi item search, and import to replace Excel-plugin



//////////CELL SELECT
window.TableKeyDownMDriven = function (thetable, angularscope) {
  thetable._cellAnchor = null;
  thetable._cellLast = null;

  thetable.addEventListener('mousedown', function (event) {
    let correcttarget = event.target;
    let isBlazor = false;
    if (correcttarget.tagName != 'TD') {
      while (correcttarget && !(correcttarget.tagName === 'DIV' && correcttarget.parentElement && correcttarget.parentElement.tagName === 'TD')) {
        correcttarget = correcttarget.parentElement; // Move to the parent element 
      }
      correcttarget = correcttarget.parentElement; // blazor
      isBlazor = true;
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
      //thecurrentcell.focus();
      thetable._mousedown = true;

    }

  });
  thetable.addEventListener('mouseup', function (event) {
    thetable._mousedown = false;
  });


  thetable.addEventListener('mousemove', function (event) {
    let correcttarget = event.target;
    let isBlazor = false;
    if (event.target.tagName == 'DIV' && event.target.parentElement.tagName == 'TD') {
      correcttarget = event.target.parentElement; // blazor
      isBlazor = true;
    }
    if (correcttarget.tagName == 'TD' && thetable._mousedown == true) {
      let thecurrentcell = correcttarget;
      thetable._cellLast = thecurrentcell;
      UpdateCellSelects(thetable, isBlazor);
    }
  });


  thetable.addEventListener('keydown', function (event) {
    const key = event.key;
    // in angular the cell is the td 
    const activeElement = document.activeElement;
    if (activeElement == null)
      return;
    let isBlazor = false;
    let correcttarget = activeElement;
    if (activeElement.tagName == 'DIV' && activeElement.parentElement.tagName == 'TD') {
      correcttarget = activeElement.parentElement; // blazor
      isBlazor = true;
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
            if (angularscope != null)
              angularscope.$emit('cellPasteMDriven', null);
          }
          break;
        case 'C', 'c':
          if (event.ctrlKey) {
            CopyDataToClipFromCellSelectMDriven(thetable, angularscope);
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
  });

}

function CopyDataToClipFromRowSelectMDriven(thetable, headerrowelement, angularscope) {

  if (!angularscope) {
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

function CopyDataToClipFromCellSelectMDriven(thetable, angularscope) {

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
  let isfirstrow = true;
  let clipdata = '';
  for (var i = minRow; i <= maxRow; i++) {
    let cellelem = body.rows[i];
    let rowhasdata = false;
    let isfirst = true;
    let rowdata = '';


    if (!angularscope) {
    }
    else {
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
          rowdata += memberitem;
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

  }

  if (!angularscope) {

  }
  else {
    angularscope.$parent.ViewData.RootVMClassObject["VM_Variables"]["vClipbookData"] = clipdata;
    angularscope.$parent.$broadcast('__vClipbookDataChanged');

  }
}


function UpdateCellSelects(thetable, isBlazor) {

  if (thetable._lastLast == null)
    thetable._lastLast = thetable._lastAnchor;

  if (thetable._lastAnchor != null) {
    let square = getSquareSelection(thetable._lastAnchor, thetable._lastLast);
    let body = thetable._lastAnchor.parentElement.parentElement;
    square.forEach(cell => {
      let cellelem = body.rows[cell.row].cells[cell.col];
      if (isBlazor)
        cellelem.children[0].classList.remove('cellselect');
      else
        cellelem.classList.remove('cellselect');
    });
    //thetable._lastAnchor.classList.remove('cellselect');
  }


  if (thetable._cellLast == null)
    thetable._cellLast = thetable._cellAnchor;

  if (thetable._cellAnchor != null) {
    let square = getSquareSelection(thetable._cellAnchor, thetable._cellLast);
    let body = thetable._cellAnchor.parentElement.parentElement;
    square.forEach(cell => {
      let cellelem = body.rows[cell.row].cells[cell.col];
      if (isBlazor)
        cellelem.children[0].classList.add('cellselect');
      else
        cellelem.classList.add('cellselect');
    });
  }



  thetable._lastAnchor = thetable._cellAnchor;
  thetable._lastLast = thetable._cellLast;
}


let selectedCells = [];
class Cell { constructor(row, col) { this.row = row; this.col = col; } }

function getSquareSelection(cell1, cell2) {
  const minRow = Math.min(cell1.parentElement.rowIndex - 1, cell2.parentElement.rowIndex - 1);
  const maxRow = Math.max(cell1.parentElement.rowIndex - 1, cell2.parentElement.rowIndex - 1);
  const minCol = Math.min(cell1.cellIndex, cell2.cellIndex);
  const maxCol = Math.max(cell1.cellIndex, cell2.cellIndex);

  const selection = [];
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      selection.push(new Cell(row, col));
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

