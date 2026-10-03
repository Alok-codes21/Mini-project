document.addEventListener('DOMContentLoaded', () => {

    const sizeInput = document.getElementById('matrixSize');
    const generateBtn = document.getElementById('generateBtn');

    const matrixAContainer = document.getElementById('matrixA');
    const matrixBContainer = document.getElementById('matrixB');

    const transposeBtn = document.getElementById('transposeBtn');
    const determinantBtn = document.getElementById('determinantBtn');
    const inverseBtn = document.getElementById('inverseBtn');


    // ---------------------------------------------------------
    // Get valid matrix size
    // ---------------------------------------------------------

    const getValidSize = () => {

        const enteredSize = Number.parseInt(
            sizeInput?.value,
            10
        );

        return Number.isNaN(enteredSize) || enteredSize <= 0
            ? 2
            : Math.min(enteredSize, 6);
    };


    // ---------------------------------------------------------
    // Create matrix grid
    // ---------------------------------------------------------

    const createMatrixGrid = (container, size) => {

        if (!container) {
            return;
        }

        container.innerHTML = '';

        const grid = document.createElement('div');

        grid.className = 'matrix-grid';

        grid.style.gridTemplateColumns =
            `repeat(${size}, 60px)`;


        for (let i = 0; i < size * size; i += 1) {

            const input = document.createElement('input');

            input.type = 'number';

            input.placeholder = `${i + 1}`;

            grid.appendChild(input);
        }


        container.appendChild(grid);
    };


    // ---------------------------------------------------------
    // Get the COMPLETE div containing Matrix B
    // ---------------------------------------------------------

    const getMatrixBWrapper = () => {

        if (!matrixBContainer) {
            return null;
        }

        /*
         * Finds the nearest div that contains Matrix B.
         *
         * If your HTML is:
         *
         * <div class="matrix-box">
         *     <h3>Matrix B</h3>
         *     <div id="matrixB"></div>
         * </div>
         *
         * then the entire .matrix-box will be hidden.
         */

        return (
            matrixBContainer.closest('.matrix-box') ||
            matrixBContainer.parentElement
        );
    };


    // ---------------------------------------------------------
    // Hide complete Matrix B div
    // ---------------------------------------------------------

    const hideMatrixB = () => {

        const matrixBWrapper = getMatrixBWrapper();

        if (matrixBWrapper) {
            matrixBWrapper.style.display = 'none';
        }
    };

    const showMatrixB = () => {

        const matrixBWrapper = getMatrixBWrapper();

        if (matrixBWrapper) {
            matrixBWrapper.style.display = '';
        }
    };
    const renderMatrices = () => {

        const size = getValidSize();

        if (sizeInput) {
            sizeInput.value = size;
        }

        createMatrixGrid(
            matrixAContainer,
            size
        );

        createMatrixGrid(
            matrixBContainer,
            size
        );

        // Initially show both matrices
        showMatrixB();
    };


    // ---------------------------------------------------------
    // Select Matrix A only
    // ---------------------------------------------------------

    const selectMatrixAOnly = () => {

        // Matrix A remains visible
        if (matrixAContainer) {

            const matrixAWrapper =
                matrixAContainer.closest('.matrix-box') ||
                matrixAContainer.parentElement;

            if (matrixAWrapper) {
                matrixAWrapper.style.display = '';
            }
        }

        // Completely hide Matrix B div
        hideMatrixB();
    };


    // ---------------------------------------------------------
    // TRANSPOSE
    // ---------------------------------------------------------

    transposeBtn?.addEventListener(
        'click',
        selectMatrixAOnly
    );


    // ---------------------------------------------------------
    // DETERMINANT
    // ---------------------------------------------------------

    determinantBtn?.addEventListener(
        'click',
        selectMatrixAOnly
    );


    // ---------------------------------------------------------
    // INVERSE
    // ---------------------------------------------------------

    inverseBtn?.addEventListener(
        'click',
        selectMatrixAOnly
    );


    // ---------------------------------------------------------
    // INITIALIZATION
    // ---------------------------------------------------------

    renderMatrices();

    sizeInput?.focus();


    // Generate button
    generateBtn?.addEventListener(
        'click',
        renderMatrices
    );


    // Size change
    sizeInput?.addEventListener(
        'change',
        renderMatrices
    );

});
