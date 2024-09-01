// Observer of changes within the document
const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                // If node itself is '.col-header-content', check if it's inside 'table.quickgrid'
                if (node.matches('.col-header-content') && node.closest('table.quickgrid')) {
                    insertDraggableButton(node);
                }
            }
        });
    });
});

// Start observing document changes
observer.observe(document.body, { childList: true, subtree: true });


// Inserts a draggable button into the given div
function insertDraggableButton(div) {
    const button = createDraggableButton();
    div.appendChild(button);
    button.onmousedown = handleMouseDown.bind(null, div);
    button.ondblclick = handleDoubleClick.bind(null, div);
}

// Creates and returns a draggable button element
function createDraggableButton() {
    const button = document.createElement('button');
    button.className = 'column-resizer';
    button.ondragstart = () => false;
    return button;
}

// Handles the mousedown event to either remove the width style or implement dragging logic
function handleMouseDown(div, event) {
    const th = div.closest('th');

    if (event.button === 0) { // LMB
        implementDraggingLogic(th, event.clientX);
    }
    else if (event.button === 1) { // MMB
        setWidth(th, ''); // Remove width style
        event.preventDefault(); // Prevent the default scroll event
    }
}

// Implements dragging logic for the given table header element
function implementDraggingLogic(th, startX) {
    const startWidth = th.offsetWidth;
    let isDragging = true;

    function onMouseMove(event) {
        if (!isDragging) return;

        requestAnimationFrame(() => {
            const newWidth = startWidth + event.clientX - startX;
            setWidth(th, newWidth + 'px');
        });
    }

    function onMouseUp() {
        isDragging = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

// Handles the double-click event to remove the width style and apply maximum content width
function handleDoubleClick(div) {
    const th = div.closest('th');
    setWidth(th, '0');

    const index = Array.from(th.parentNode.children).indexOf(th);
    const table = th.closest('table');
    let maxWidth = 0;

    table.querySelectorAll('tbody tr').forEach(row => {
        const cell = row.children[index];
        const originalStyle = cell.style.cssText;
        cell.style.whiteSpace = 'nowrap';
        cell.style.overflow = 'visible';
        cell.style.textOverflow = 'clip';

        const cellWidth = cell.scrollWidth;
        if (cellWidth > maxWidth) {
            maxWidth = cellWidth;
        }

        cell.style.cssText = originalStyle;
    });

    setWidth(th, maxWidth + 5 + 'px');
}

function setWidth(element, width) {
    element.style.width = width;
}
