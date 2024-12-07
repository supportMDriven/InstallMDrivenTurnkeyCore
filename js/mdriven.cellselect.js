// aim is to implement CellSelect, copy and paste to and from excel, also handle multi item search, and import to replace Excel-plugin



//////////CELL SELECT
window.TableKeyDownMDriven = function (thetable) {
  thetable._cellAnchor = null;
  thetable._cellLast = null;
 
  thetable.addEventListener('mousedown', function (event) {
    if (event.target.tagName == 'TD') {
      let thecurrentcell = event.target;
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

      UpdateCellSelects(thetable);
      thecurrentcell.focus();
      thetable._mousedown = true;

    }

  });
  thetable.addEventListener('mouseup', function (event) {
    thetable._mousedown = false;
  });


  thetable.addEventListener('mousemove', function (event) {
    if (event.target.tagName == 'TD' && thetable._mousedown == true) {
      let thecurrentcell = event.target;
      thetable._cellLast = thecurrentcell;
      UpdateCellSelects(thetable);
    }
  });


  thetable.addEventListener('keydown', function (event) {
    const key = event.key;
    // in angular the cell is the td 
    const activeElement = document.activeElement;
    if (activeElement == null)
      return;
      if (activeElement.tagName === 'TD' ) { 

    }


    if (activeElement.tagName === 'TD' ) {
      let thecurrentcell = activeElement;
      let thecurrentrow = activeElement.parentElement;
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
        case 'Enter': {
          const input = thecurrentcell.querySelector('input');
          if (input) {
            input.focus();
          }
          return;
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
      UpdateCellSelects(thetable);
      nextCell.focus();
      event.preventDefault();
    }
  });

}

function UpdateCellSelects(thetable) {

  if (thetable._lastLast == null)
    thetable._lastLast = thetable._lastAnchor;

  if (thetable._lastAnchor != null) {
    let square = getSquareSelection(thetable._lastAnchor, thetable._lastLast);
    let body = thetable._lastAnchor.parentElement.parentElement;
    square.forEach(cell => { body.rows[cell.row].cells[cell.col].classList.remove('cellselect'); });
    //thetable._lastAnchor.classList.remove('cellselect');
  }


  if (thetable._cellLast == null)
    thetable._cellLast = thetable._cellAnchor;

  if (thetable._cellAnchor != null) {
    let square = getSquareSelection(thetable._cellAnchor, thetable._cellLast);
    let body = thetable._cellAnchor.parentElement.parentElement;
    square.forEach(cell => { body.rows[cell.row].cells[cell.col].classList.add('cellselect'); });
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

