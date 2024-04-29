import { Algorithm, AlgorithmInput } from './algorithm';
import { Observable, Observer } from './observer';

import * as pako from 'pako';
import { Base64 } from 'js-base64';
import assert from 'assert';



export class Settings {
    public outputPrecision: number = 5;
    public showPivot: boolean = false;
}

export class ModelInput {
    valueStrings: Array<string> = ["3.14159", "1.0"];
    mask: Array<boolean> = [true, true];
}


export class Model implements Observable {
    public static defaultSettings: Settings = new Settings();
    public static defaultModelInput: ModelInput = new ModelInput();

    private observers: Array<Observer> = [];

    private algorithm: Algorithm;

    // Serialized state

    private modelInput: ModelInput = new ModelInput();
    private settings: Settings = new Settings();

    private serialized: string="";

    // Computed state
    private algorithmInput: AlgorithmInput = new AlgorithmInput();
    private inputPrecision: Array<number> = [];

    private finished: boolean = false;
    private ratioOutputs: Array<Array<number>> = [];
    private ratioScalars: Array<number> = [];
    private pivotSequence: Array<number> = [];


    public constructor(algorithm: Algorithm) {
        this.algorithm = algorithm;
        this.setAlgorithmInput();
        // let url = new URL(window.location.href);
    }

    
    // Observer pattern

    public addObserver(observer: Observer): void {
        this.observers.push(observer);
    }

    public removeObserver(observer: Observer): void {
        this.observers = this.observers.filter((obs) => obs != observer);
    }


    // Logic

    public restart(): void {
        console.log("Restarting model.");
        this.ratioOutputs = [];
        this.ratioScalars = [];
        this.pivotSequence = [];
        this.finished = false;

        for (let observer of this.observers) {
            observer.onFinished(false);
        }

        if (this.getLength() < 20) {
            this.computeLines(10);
        }
    }

    public computeLines(count: number): void {
        for (let i = 0; i < count; i++) {
            this.computeStep();
        }
        for (let observer of this.observers) {
            observer.onDataChanged();
        }
    }

    private computeStep(): void {
        if (this.finished) { return; }
        let result = this.algorithm.step();
        if (result) {
            this.ratioOutputs.push(result);
            this.ratioScalars.push(this.algorithm.ratioFactor());
            this.pivotSequence.push(this.algorithm.getCurrentPivot());
        } else {
            this.setFinished(true);
        }
    }


    // Inputs
    private setAlgorithmInput(): void {
        let values = this.modelInput.valueStrings.map(parseFloat);
        this.inputPrecision = this.modelInput.valueStrings.map(Model.precisionFromString);
        this.algorithmInput = { ratio: values, mask: this.modelInput.mask, precision: this.inputPrecision };
        this.algorithm.setInput(this.algorithmInput);
        console.log("Set algorithm input to " + JSON.stringify(this.algorithmInput));
    }

    public reset(): void {
        this.modelInput = structuredClone(Model.defaultModelInput);
        this.settings = structuredClone(Model.defaultSettings);

        this.setAlgorithmInput();

        for (let observer of this.observers) {
            observer.onInputsChanged();
            observer.onSettingsChanged();
        }

        this.restart();
    }

    public getModelInput(): ModelInput {
        return this.modelInput
    }

    private static precisionFromString(valueString: string): number {
        let trailingDecimalPlace = 0; // place of least significant nonzero digit of the number. e.g. 0.001 has decimalPlace = 3 and 200 has decimalPlace = -2
        let leadingDecimalPlace: number;
        let precisionNum: number;
        if (valueString.includes('.')) {
            trailingDecimalPlace = valueString.split('.')[1].length;
            leadingDecimalPlace = valueString.indexOf('.');
            // if the number ends with 0
            if (valueString.endsWith('0')) {
                precisionNum = leadingDecimalPlace - 15;
            } else {
                precisionNum = Math.max(leadingDecimalPlace - 15, -trailingDecimalPlace);
            }

        } else {
            leadingDecimalPlace = valueString.length - 1;
            let trailingZeros = valueString.length - valueString.replace(/0+$/, '').length;
            trailingDecimalPlace = trailingZeros;
            precisionNum = Math.max(leadingDecimalPlace - 15, trailingDecimalPlace);
        }
        let precision = Math.pow(10, precisionNum);
        return precision / 2;
    }

    public setInput(modelInput: ModelInput): void {
        this.modelInput = modelInput;
        this.setAlgorithmInput();

        for (let observer of this.observers) {
            observer.onInputsChanged();
        }

        this.restart();
    }

    public setInputRaw(valueStrings: Array<string>, mask: Array<boolean>): void {
        this.modelInput.valueStrings = valueStrings;
        this.modelInput.mask = mask;
        this.setAlgorithmInput();

        for (let observer of this.observers) {
            observer.onInputsChanged();
        }

        this.restart();
    }

    public setValueFromString(i: number, valueString: string): void {
        // assert that valuestring represents a number
        // assert(!isNaN(parseFloat(valueString)), 'Value string should represent a number');
        let value = parseFloat(valueString);

        // determine precision of value
        let precision = Model.precisionFromString(valueString);

        this.modelInput.valueStrings[i] = valueString;
        this.inputPrecision[i] = precision;

        this.setAlgorithmInput();
        
        for (let observer of this.observers) {
            observer.onInputsChanged();
        }
        this.restart();
    }

    public getMask(): Array<boolean> {
        return this.modelInput.mask;
    }

    public setMaskValue(i: number, value: boolean): void {
        this.modelInput.mask[i] = value;
        this.algorithmInput.mask[i] = value;
        this.setAlgorithmInput();

        for (let observer of this.observers) {
            observer.onInputsChanged();
        }

        this.restart();
    }

    public getLength(): number {
        return this.modelInput.valueStrings.length;
    }

    public setLength(length: number): void {
        let valueStrings = this.modelInput.valueStrings;
        let mask = this.modelInput.mask;
        if (length > valueStrings.length) {
            for (let i = valueStrings.length; i < length; i++) {
                valueStrings.push("1.0");
                mask.push(true);
            }
        } else if (length < valueStrings.length) {
            this.modelInput.valueStrings = valueStrings = valueStrings.slice(0, length);
            this.modelInput.mask = mask = mask.slice(0, length);
        }
        for (let observer of this.observers) {
            observer.onInputsChanged();
        }
        this.setAlgorithmInput();

        this.restart();
    }

    public getValueStrings(): Array<string> {
        return this.modelInput.valueStrings;
    }

    public getValues(): Array<number> {
        return this.algorithmInput.ratio;
    }

    // Settings

    public getPrecision(): number {
        return this.settings.outputPrecision;
    }

    public setOutputPrecision(precision: number): void {
        this.settings.outputPrecision = precision;
        for (let observer of this.observers) {
            observer.onSettingsChanged();
        }
    }

    public setShowPivot(showPivot: boolean): void {
        this.settings.showPivot = showPivot;
        for (let observer of this.observers) {
            observer.onSettingsChanged();
        }
    }

    public getShowPivot(): boolean {
        return this.settings.showPivot;
    }


    // Serialization

    public serializeState(): string {
        // json stringify, then zip, then base64 encode
        let isNotDefault: boolean = false;
        let json: { values?: string[]; mask?: boolean[]; settings?: Settings; version: string; } = { version: "0.1.0" };

        if (Model.arraysAreEqual(this.modelInput.valueStrings, Model.defaultModelInput.valueStrings) == false) {
            json['values'] = this.modelInput.valueStrings;
            isNotDefault = true;
        }
        if (Model.arraysAreEqual(this.modelInput.mask, Model.defaultModelInput.mask) == false) {
            json['mask'] = this.modelInput.mask;
            isNotDefault = true;
        }
        if (Model.settingsAreEqual(this.settings, Model.defaultSettings) == false) {
            json['settings'] = this.settings;
            isNotDefault = true;
        }

        if (!isNotDefault) {
            return "";
        }

        let stringified = JSON.stringify(json);

        let zipped = pako.deflate(stringified);
        let base64encoded = Base64.fromUint8Array(zipped);

        return base64encoded;
    }

    public deserializeState(base64encoded: string): boolean {
        // base64 decode, then unzip, then json parse
        let zipped = Base64.toUint8Array(base64encoded);
        let unzipped = pako.inflate(zipped);
        let stringified = new TextDecoder().decode(unzipped);
        let parsed = JSON.parse(stringified);

        let version = parsed.version;
        let currentVersion = "0.1.0";
        if (version != currentVersion) {
            console.error('Version mismatch: expected ' + currentVersion + ', got ' + version + '.)');
            let url = new URL(window.location.href);
            url.searchParams.delete('state');
            history.replaceState({ model: '' }, 'title', url.toString());
            return false;
        }

        let isNumberArray = (a: any): boolean => {
            return Array.isArray(a) && a.every((x: any) => typeof x === 'number');
        }
        let isNumberStringArray = (a: any): boolean => {
            return Array.isArray(a) && a.every((x: any) => typeof x === 'string' && !isNaN(parseFloat(x)) && !isNaN(Number(x)));
        }
        let isBoolArray = (a: any): boolean => {
            return Array.isArray(a) && a.every((x: any) => typeof x === 'boolean');
        }
        let hasType = (a: any, type: string): boolean => {
            return typeof a === type;
        }

        this.modelInput.valueStrings = (!isNumberStringArray(parsed.values)) ? structuredClone(Model.defaultModelInput.valueStrings) : parsed.values;
        this.modelInput.mask = (!isBoolArray(parsed.mask)) ? structuredClone(Model.defaultModelInput.mask) : parsed.mask;

        if (parsed.settings != undefined) {
            this.settings.outputPrecision = (!hasType(parsed.settings.outputPrecision, "number")) ? Model.defaultSettings.outputPrecision : parsed.settings.outputPrecision;
            this.settings.showPivot = (!hasType(parsed.settings.showPivot, "boolean")) ? Model.defaultSettings.showPivot : parsed.settings.showPivot;
        }
        
        this.setAlgorithmInput();

        for (let observer of this.observers) {
            observer.onSettingsChanged();
            observer.onInputsChanged();
        }

        console.log("Deserialized state: " + stringified);

        return true;
    }


    private setFinished(finished: boolean): void {
        let notify = this.finished != finished;
        this.finished = finished;
        if (notify) {
            for (let observer of this.observers) {
                observer.onDataChanged();
                observer.onFinished(finished);
            }
        }
    }

    private static arraysAreEqual(a: Array<any>, b: Array<any>): boolean {
        return a.length == b.length && a.every((v, i) => v === b[i]);
    }

    private static settingsAreEqual(a: Settings, b: Settings): boolean {
        return a.outputPrecision == b.outputPrecision && a.showPivot == b.showPivot;
    }


    // Getters for Results

    public getFinished(): boolean {
        return this.finished;
    }

    public getRatioOutputs(): Array<Array<number>> {
        return this.ratioOutputs;
    }

    public getRatioScalar(i: number): number {
        return this.ratioScalars[i];
    }

    public getPivot(i: number): number {
        return this.pivotSequence[i];
    }

    public getSerialized(): string {
        return this.serialized;
    }

}

