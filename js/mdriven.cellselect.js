// aim is to implement CellSelect, copy and paste to and from excel, also handle multi item search, and import to replace Excel-plugin



//////////CELL SELECT
window.TableKeyDownMDriven= function (thetable) {

  thetable.addEventListener('keydown', function (event) {
    const key = event.key;
    const activeElement = document.activeElement;
    if (activeElement.tagName === 'DIV' && activeElement.parentElement.tagName === 'TD') {
      let thecurrentcell = activeElement.parentElement;
      let thecurrentrow = activeElement.parentElement.parentElement;
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
        default:
          return; // Quit when this doesn't handle the key event.
      }

      console.log(row + ' ' + col);
      if (!event.shiftKey)
        activeElement.classList.remove('cellselect');
      const nextCell = thecurrentrow.parentElement.rows[row].cells[col];
      let nextDiv = nextCell.children[0];
      nextDiv.classList.add('cellselect');
      nextDiv.focus();
      event.preventDefault();
    }
  });

}


let selectedCells = [];

function getSquareSelection(cell1, cell2) {
  const minRow = Math.min(cell1.row, cell2.row);
  const maxRow = Math.max(cell1.row, cell2.row);
  const minCol = Math.min(cell1.col, cell2.col);
  const maxCol = Math.max(cell1.col, cell2.col);

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

