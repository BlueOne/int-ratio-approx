
import * as math from 'mathjs';
import * as pako from 'pako';
import { Base64 } from 'js-base64';

class Model {
    private static instance: Model;

    // Serialized state
    private values: Array<number> = [3.14159, 1.0];
    private length: number = this.values.length;
    private mask: Array<boolean> = [true, true];
    private precision: number = 4;

    // Computed state
    private finished: boolean = false;
    private ratioOutputs: Array<Array<number>> = [];
    private ratioScalars: Array<number> = [];

    private constructor() {
    }


    public static getInstance(): Model {
        if (!Model.instance) {
            Model.instance = new Model();
        }
        return Model.instance;
    }

    public restart(changeUrl: boolean=true): void {
        this.finished = false;
        this.clearRatioOutputs();
        this.clearRatioScalars();
        Algorithm.getInstance().reset();

        if (changeUrl) {
            this.changeUrl();
        }

        if (this.getLength() < 20) {
            for (let i = 0; i < 10; i++) {
                this.computeStep();
            }
        }
    }

    public computeStep(): void {
        if (this.getFinished()) { return; }
        let algorithm = Algorithm.getInstance();
        let result = algorithm.step();
        if (result) {
            this.addRatioOutput(result);
            this.addRatioScalar(algorithm.ratioFactor());
        } else {
            this.setFinished(true);
        }
        GUI.getInstance().notifyDataChanged();
    }


    public changeUrl(): void {
        let serialized = this.serializeState();
        history.pushState({ model: serialized }, 'title', '/index.html?state=' + serialized);
    }

    public getValues(): Array<number> {
        return this.values;
    }

    public setValues(values: Array<number>): void {
        this.values = values;
        this.length = values.length;

        this.restart();
    }

    public setValue(i: number, value: number): void {
        this.values[i] = value;
        this.restart();
    }

    public getMask(): Array<boolean> {
        return this.mask;
    }

    public setMaskValue(i: number, value: boolean): void {
        this.mask[i] = value;
        this.restart();
    }

    public getFinished(): boolean {
        return this.finished;
    }

    public setFinished(finished: boolean): void {
        this.finished = finished;
        GUI.getInstance().notifyFinished(finished);
    }

    public getPrecision(): number {
        return this.precision;
    }

    public setPrecision(precision: number): void {
        GUI.getInstance().changePrecision(precision);
        this.precision = precision;
        GUI.getInstance().notifyPrecisionChanged();
        this.changeUrl();
    }

    public getLength(): number {
        return this.length;
    }

    public setLength(length: number): void {
        GUI.getInstance().changeNumberOfInputs(length);

        this.length = length;
        if (length > this.values.length) {
            for (let i = this.values.length; i < length; i++) {
                this.values.push(1.0);
                this.mask.push(true);
            }
        } else if (length < this.values.length) {
            this.values = this.values.slice(0, length);
            this.mask = this.mask.slice(0, length);
        }
        this.restart();
    }

    public serializeState(): string {
        // json stringify, then zip, then base64 encode
        try {
            let stringified = JSON.stringify({
                v: this.values,
                m: this.mask,
                p: this.precision,
                l: this.length
            });

            let zipped = pako.deflate(stringified);
            let base64encoded = Base64.fromUint8Array(zipped);

            return base64encoded;
        } catch (error) {
            console.error('Error serializing state: ' + error);
            return '';
        }
    }

    public deserializeState(base64encoded: string): boolean {
        // base64 decode, then unzip, then json parse
        try {
            let zipped = Base64.toUint8Array(base64encoded);
            let unzipped = pako.inflate(zipped);
            let stringified = new TextDecoder().decode(unzipped);
            let parsed = JSON.parse(stringified);

            let io = GUI.getInstance();
            io.changeNumberOfInputs(parsed.l);
            io.changePrecision(parsed.p);

            this.values = parsed.v;
            this.mask = parsed.m;
            this.precision = parsed.p;
            this.length = parsed.l;

            io.notifyTopRowChanged();
            Algorithm.getInstance().reset();
            this.restart(false);
            return true
        } catch (error) {
            console.error('Error deserializing state: ' + error);
            // set url to default
            // history.pushState({ model: '' }, 'title', '/index.html');
            history.replaceState({ model: '' }, 'title', '/index.html');
            return false;
        }
    }



    public clearRatioOutputs(): void {
        this.ratioOutputs = [];
    }

    public addRatioOutput(output: Array<number>): void {
        this.ratioOutputs.push(output);
    }

    public getRatioOutputs(): Array<Array<number>> {
        return this.ratioOutputs;
    }

    public getRatioScalar(i: number): number {
        return this.ratioScalars[i];
    }

    public addRatioScalar(scalar: number): void {
        this.ratioScalars.push(scalar);
    }

    public clearRatioScalars(): void {
        this.ratioScalars = [];
    }
}

class GUI {
    private static instance: GUI;

    private static showPivot: boolean = false;

    private mainTable: HTMLTableElement;
    private mainTableTopRow: HTMLTableRowElement;

    private lengthInput: HTMLInputElement;
    private computeButton: HTMLButtonElement;

    public changePrecision(newPrecision: number): void {
        let precisionInput = document.getElementById('precision-input') as HTMLInputElement;
        precisionInput.value = newPrecision.toString();
    }

    public changeNumberOfInputs(newCount: number): void {
        // set oldCount to the current number of cells in the top row
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

    private addValueInput(value = "1"): void {
        let cell = document.createElement('th');
        cell.style.minWidth = '6.5em';
        this.mainTableTopRow.appendChild(cell);
        let index = this.mainTableTopRow.childElementCount - 1;

        let input = document.createElement('input');
        input.type = 'string';
        input.value = value;
        input.addEventListener('change', GUI.handleValueChange);
        input.id = 'value' + index;
        input.style.width = '5em';
        cell.appendChild(input);

        let checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = true;
        checkbox.addEventListener('change', GUI.handleMaskChange);
        checkbox.id = 'value-active' + index;
        checkbox.style.accentColor = 'lightgrey';
        cell.appendChild(checkbox);
    }

    private deleteValueInput(): void {
        let cell = this.mainTableTopRow.lastElementChild;
        if (cell) {
            this.mainTableTopRow.removeChild(cell);
        }
    }

    private constructor() {
        let length = Model.getInstance().getLength();
        this.lengthInput = document.getElementById('length-input') as HTMLInputElement;
        this.lengthInput.value = length.toString();
        this.lengthInput.addEventListener('change', GUI.handleLengthChange);

        this.mainTable = document.getElementById('main-table') as HTMLTableElement;
        this.mainTableTopRow = this.mainTable.getElementsByTagName('tr')[0] as HTMLTableRowElement;

        // Clear the table
        while (this.mainTableTopRow.lastElementChild) {
            this.mainTableTopRow.removeChild(this.mainTableTopRow.lastElementChild);
        }

        // Add the initial value inputs
        let values = Model.getInstance().getValues();
        for (let i = 0; i < length; i++) {
            this.addValueInput(values[i].toString());
        }

        // Register buttons
        this.computeButton = document.getElementById('compute-button') as HTMLButtonElement;
        this.computeButton.addEventListener('click', GUI.handleComputeButton);
        // this.computeButton.style.backgroundColor = 'lightblue';
        // this.computeButton.style.border = 'none';
        let precisionInput = document.getElementById('precision-input') as HTMLInputElement;
        precisionInput.value = Model.getInstance().getPrecision().toString();
        precisionInput.addEventListener('change', GUI.handlePrecisionChange);

        this.resetUI()
    }

    public static getInstance(): GUI {
        if (!GUI.instance) {
            GUI.instance = new GUI();
        }
        return GUI.instance;
    }

    public static handlePrecisionChange(): void {
        let newPrecision = parseInt((document.getElementById('precision-input') as HTMLInputElement).value);
        if (!newPrecision || isNaN(newPrecision) || newPrecision < 0) {
            return;
        }

        Model.getInstance().setPrecision(newPrecision);
    }

    public static handleLengthChange(): void {
        const instance = GUI.getInstance();
        let newLength = parseInt(instance.lengthInput.value);
        if (!newLength || newLength < 2) {
            return;
        }

        Model.getInstance().setLength(newLength);
    }

    public static handleValueChange(event: Event): void {
        const targetElement = event.target as HTMLInputElement;
        let i = parseInt(targetElement.id.replace('value', ''));
        // check if targetElement.value represents a valid number
        let value = parseFloat(targetElement.value);
        if (!isNaN(value) && !isNaN(Number(targetElement.value)) && value > 0.0) {
            Model.getInstance().setValue(i, value);
            targetElement.style.color = 'black';
        } else {
            targetElement.style.color = 'red';
        }
    }

    public static handleMaskChange(event: Event): void {
        const targetElement = event.target as HTMLInputElement;
        let i = parseInt(targetElement.id.replace('value-active', ''));
        Model.getInstance().setMaskValue(i, targetElement.checked);
    }

    public static handleComputeButton() {
        const model = Model.getInstance();
        for (let i = 0; i < 5; i++)
            model.computeStep();
    }


    private drawTableRow(i: number): void {
        let model = Model.getInstance();
        let results = model.getRatioOutputs();
        let algorithm = Algorithm.getInstance();

        let ratio = results[i];
        let row = this.mainTable.insertRow(-1);
        row.style.fontWeight = 'bold';
        let pivot = algorithm.getCurrentPivot();
        let length = Model.getInstance().getLength();
        for (let i = 0; i < length; i++) {
            let cell = row.insertCell(-1);
            cell.innerHTML = ratio[i].toString();
            if (i == pivot && GUI.showPivot) {
                cell.style.backgroundColor = 'LightGoldenRodYellow';
            }
        }
        let factor = model.getRatioScalar(i);
        // scaled = values * factor
        let scaled = model.getValues().map((value) => value * factor);
        row = this.mainTable.insertRow(-1);
        row.style.color = 'grey';
        let precision = Model.getInstance().getPrecision();
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
        cell.colSpan = Model.getInstance().getLength();
        cell.innerHTML = 'Converged.';
    }

    public resetUI(): void {
        this.clearTable();
        this.setComputeButtonEnabled(true);
    }

    public notifyFinished(finished: boolean): void {
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

    public notifyTopRowChanged(): void {
        let values = Model.getInstance().getValues();
        for (let i = 0; i < values.length; i++) {
            let input = document.getElementById('value' + i) as HTMLInputElement;
            input.value = values[i].toString();
        }
        let mask = Model.getInstance().getMask();
        for (let i = 0; i < mask.length; i++) {
            let checkbox = document.getElementById('value-active' + i) as HTMLInputElement;
            checkbox.checked = mask[i];
        }
    }

    public notifyDataChanged(): void {
        this.clearTable();
        let model = Model.getInstance();
        let results = model.getRatioOutputs();
        for (let i = 0; i < results.length; i++) {
            this.drawTableRow(i);
        }
        if (model.getFinished()) {
            this.drawTableFinishedRow();
        }
    }
    
    public notifyPrecisionChanged(): void {
        this.notifyDataChanged();
    }


}


class Algorithm {
    private static instance: Algorithm;
    private m: math.Matrix;
    private x: math.Matrix;
    private pivotSequence: Array<number> = [];

    private constructor() {
        this.m = math.identity(2) as math.Matrix;
        this.x = math.matrix(Model.getInstance().getValues()) as math.Matrix;
    }

    public static getInstance(): Algorithm {
        if (!Algorithm.instance) {
            Algorithm.instance = new Algorithm();
        }
        return Algorithm.instance;
    }

    public reset(): void {
        this.m = math.identity(Model.getInstance().getLength()) as math.Matrix;
        this.x = math.matrix(Model.getInstance().getValues()) as math.Matrix;
        this.pivotSequence = [];
    }

    public step(tolerance: number = 1e-10): Array<number> | null {
        // set pivot to be the index of the smallest value of x
        let pivot = -1;
        let smallest = Infinity;
        let belowTolerance = 0;
        let mask = Model.getInstance().getMask()
        let length = Model.getInstance().getLength();

        for (let i = 0; i < length; i++) {
            let value = this.x.get([i]);
            if (value < tolerance || !mask[i]) {
                belowTolerance++;
            }
            if (value < smallest && value > tolerance && mask[i]) {
                smallest = value;
                pivot = i;
            }
        }

        if (pivot == -1 || belowTolerance == length - 1) {
            return null;
        }

        this.pivotSequence.push(pivot);

        for (let i = 0; i < length; i++) {
            if (i != pivot) {
                // divmod of x[i] by x[pivot]
                let quotient = Math.floor(this.x.get([i]) / this.x.get([pivot]));
                let remainder = this.x.get([i]) % this.x.get([pivot]);

                this.x.set([i], remainder);

                // m[pivot, *] += quotient * m[i, *]
                for (let j = 0; j < length; j++) {
                    this.m.set([pivot, j], this.m.get([pivot, j]) + quotient * this.m.get([i, j]));
                }
            }
        }

        // return m[pivot, *]
        let result = [];
        for (let i = 0; i < length; i++) {
            result.push(this.m.get([pivot, i]));
        }
        return result;
    }

    public getCurrentPivot(): number {
        return this.pivotSequence[this.pivotSequence.length - 1];
    }

    public getCurrentApproximation(): Array<number> {
        let pivot = this.pivotSequence[this.pivotSequence.length - 1];
        let length = Model.getInstance().getLength();

        let currentApproximation = [];
        for (let i = 0; i < length; i++) {
            currentApproximation.push(this.m.get([pivot, i]));
        }
        return currentApproximation;
    }

    public ratioFactor(): number {
        let currentApproximation = this.getCurrentApproximation();
        let values = Model.getInstance().getValues();

        let sum = (a: Array<number>):number => {
            let result = 0;
            for (let i = 0; i < a.length; i++) {
                result += a[i];
            }
            return result;
        };

        let sumCurrentApproximation = sum(currentApproximation);
        let sumValues = sum(values);

        let factor = sumCurrentApproximation / sumValues;
        return factor
    }
}



function initialize() : void {
    let io = GUI.getInstance();
    let model = Model.getInstance();

    let url = new URL(window.location.href);
    let state = url.searchParams.get('state');
    if (state && state != "") {
        model.deserializeState(state);
    } else {
        model.restart(false);
    }
}

window.addEventListener('popstate', initialize);

initialize()