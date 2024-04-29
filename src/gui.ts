import { Model } from "./model";
import { Observer } from "./observer";

/*  Gui class
    Renders HTML user interface. Observes the Model class and updates the UI when the Model changes. Handles User Input. This is a singleton class because it relies on specific DOM elements to be present.
*/
export class Gui implements Observer{
    private static instance: Gui;
    private model: Model;

    private mainTable: HTMLTableElement;
    private mainTableTopRow: HTMLTableRowElement;

    private lengthInput: HTMLInputElement;
    private computeButton: HTMLButtonElement;

    private changeNumberOfInputs(newCount: number): void {
        let oldCount = this.mainTableTopRow.childElementCount;
        this.lengthInput.value = newCount.toString();
        if (oldCount < newCount) {
            for (let i = oldCount; i < newCount; i++) {
                this.addValueInput();
            }
        }
        if (oldCount > newCount) {
            for (let i = oldCount; i > newCount; i--) {
                this.deleteValueInput();
            }
        }
    }

    private changeShowPivot(showPivot: boolean): void {
        let checkbox = document.getElementById('pivot-input') as HTMLInputElement;
        checkbox.checked = showPivot;
        this.redrawTable();
    }

    private changePrecision(newPrecision: number): void {
        let precisionInput = document.getElementById('precision-input') as HTMLInputElement;
        precisionInput.value = newPrecision.toString();
    }


    private addValueInput(value = "1", checked=true): void {
        let cell = document.createElement('th');
        cell.style.minWidth = '6.5em';
        this.mainTableTopRow.appendChild(cell);
        let index = this.mainTableTopRow.childElementCount - 1;

        let input = document.createElement('input');
        input.type = 'string';
        input.value = value;
        input.addEventListener('change', this.handleValueChange.bind(this));
        input.id = 'value' + index;
        input.style.width = '5em';
        cell.appendChild(input);

        let checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = checked;
        checkbox.addEventListener('click', this.handleMaskChange.bind(this));
        checkbox.id = 'value-active' + index;
        checkbox.className = "mask-checkbox"
        // checkbox.style.accentColor = 'lightgrey';
        cell.appendChild(checkbox);


    }

    private deleteValueInput(): void {
        let cell = this.mainTableTopRow.lastElementChild;
        if (cell) {
            this.mainTableTopRow.removeChild(cell);
        }
    }

    private constructor(model: Model) {
        this.model = model;

        let resetButton = document.getElementById('reset-button') as HTMLButtonElement;
        resetButton.addEventListener('click', () => {
            this.model.reset();
        });
        let length = model.getLength();
        this.lengthInput = document.getElementById('length-input') as HTMLInputElement;
        this.lengthInput.value = length.toString();
        this.lengthInput.addEventListener('change', this.handleLengthChange.bind(this));

        this.mainTable = document.getElementById('main-table') as HTMLTableElement;
        this.mainTableTopRow = this.mainTable.getElementsByTagName('tr')[0] as HTMLTableRowElement;

        // Clear the table
        while (this.mainTableTopRow.lastElementChild) {
            this.mainTableTopRow.removeChild(this.mainTableTopRow.lastElementChild);
        }

        // Add the initial value inputs
        let values = model.getValueStrings();
        let mask = model.getMask();
        for (let i = 0; i < length; i++) {
            this.addValueInput(values[i], mask[i]);
        }

        // Register buttons
        this.computeButton = document.getElementById('compute-button') as HTMLButtonElement;
        this.computeButton.addEventListener('click', this.handleComputeButton.bind(this));
        // this.computeButton.style.backgroundColor = 'lightblue';
        // this.computeButton.style.border = 'none';
        let precisionInput = document.getElementById('precision-input') as HTMLInputElement;
        precisionInput.value = model.getPrecision().toString();
        precisionInput.addEventListener('change', this.handleOutputPrecisionChange.bind(this));

        let pivotInput = document.getElementById('pivot-input') as HTMLInputElement;
        pivotInput.addEventListener('change', this.handleShowPivotChange.bind(this));

        this.clearTable();
        this.setComputeButtonEnabled(true);
    }

    public static getInstance(): Gui {
        if (!Gui.instance) {
            throw new Error('Gui not initialized.');
        }
        return Gui.instance;
    }

    public static initialize(model: Model): void {
        Gui.instance = new Gui(model);
    }

    private drawTableRow(i: number): void {
        let results = this.model.getRatioOutputs();

        let ratio = results[i];
        let row = this.mainTable.insertRow(-1);
        row.className = 'output-row-primary';

        let pivot = this.model.getPivot(i);
        let length = this.model.getLength();
        for (let i = 0; i < length; i++) {
            let cell = row.insertCell(-1);
            cell.innerHTML = ratio[i].toString();
            if (i == pivot && this.model.getShowPivot()) {
                cell.className = 'pivot-cell';
            }
        }
        let factor = this.model.getRatioScalar(i);
        // scaled = values * factor
        let scaled = this.model.getValues().map((value) => value * factor);
        row = this.mainTable.insertRow(-1);
        row.className = 'output-row-secondary';

        let precision = this.model.getPrecision();
        for (let i = 0; i < length; i++) {
            let cell = row.insertCell(-1);
            cell.innerHTML = scaled[i].toPrecision(precision);
        }
    }

    private clearTable(): void {
        // Remove all rows except for the first one
        while (this.mainTable.rows.length > 1) {
            this.mainTable.deleteRow(1);
        }
    }


    private drawTableFinishedRow(): void {
        let row = this.mainTable.insertRow(-1);
        let cell = row.insertCell(-1);
        cell.colSpan = this.model.getLength();
        cell.innerHTML = 'Done.';
    }

    public onFinished(finished: boolean): void {
        this.setComputeButtonEnabled(!finished);
    }

    private setComputeButtonEnabled(enabled: boolean): void {
        this.computeButton.disabled = !enabled;
        if (enabled) {
            this.computeButton.textContent = 'Compute More';
        } else {
            this.computeButton.textContent = 'Finished.';
        }
    }

    public onDataChanged(): void {
        this.redrawTable();
    }

    private redrawTable(): void {
        this.clearTable();
        let model = this.model;
        let results = model.getRatioOutputs();
        for (let i = 0; i < results.length; i++) {
            this.drawTableRow(i);
        }
        if (model.getFinished()) {
            this.drawTableFinishedRow();
        }
    }
    
    public onSettingsChanged(): void {
        this.changePrecision(this.model.getPrecision());
        this.changeShowPivot(this.model.getShowPivot());
        this.redrawTable();
    }

    public onInputsChanged(): void {
        let values = this.model.getValueStrings();
        let mask = this.model.getMask();
        let length = values.length;
        this.changeNumberOfInputs(length);

        for (let i = 0; i < values.length; i++) {
            let input = document.getElementById('value' + i) as HTMLInputElement;
            input.value = values[i];
        }
        for (let i = 0; i < mask.length; i++) {
            let checkbox = document.getElementById('value-active' + i) as HTMLInputElement;
            checkbox.checked = mask[i];
        }
    }

    public handleOutputPrecisionChange(event: Event): void {
        let targetElement = event.target as HTMLInputElement;
        let newPrecision = parseInt(targetElement.value);
        if (!newPrecision || isNaN(newPrecision) || newPrecision < 0) {
            return;
        }

        this.model.setOutputPrecision(newPrecision);
    }

    public handleLengthChange(event: Event): void {
        let lengthInput = event.target as HTMLInputElement;
        let newLength = parseInt(lengthInput.value);
        if (!newLength || newLength < 2) {
            return;
        }

        this.model.setLength(newLength);
    }

    public handleValueChange(event: Event): void {      
        const targetElement = event.target as HTMLInputElement;
        let valueString = targetElement.value;
        let value = parseFloat(targetElement.value);
        let i = parseInt(targetElement.id.replace('value', ''));
        let isNumber = !isNaN(value) && !isNaN(Number(targetElement.value));

        if (!isNumber || value < 0.0) {
            targetElement.style.color = 'red';
            return;
        }

        this.model.setValueFromString(i, valueString);
        targetElement.style.color = 'black';
    }

    public handleMaskChange(event: Event): void {       
        const targetElement = event.target as HTMLInputElement;
        let i = parseInt(targetElement.id.replace('value-active', ''));
        this.model.setMaskValue(i, targetElement.checked);
    }

    public handleComputeButton() {
        this.model.computeLines(5);
    }

    public handleShowPivotChange(event: Event): void {
        let targetElement = event.target as HTMLInputElement;
        this.model.setShowPivot(targetElement.checked);
    }
}

