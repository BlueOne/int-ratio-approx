import * as math from 'mathjs';
import { strict as assert } from 'assert';

/*  Algorithm class
    Generalization of the continued fraction algorithm for approximating a ratio of real numbers with integers. 
*/

export class AlgorithmInput {
    ratio: Array<number> = [3.14159, 1];
    mask: Array<boolean> = [true, true];
    precision: Array<number> = [1e-5, 1e-5];

    static default: AlgorithmInput = new AlgorithmInput();
}

export class Algorithm {
    public static fast: boolean = true;

    private m: math.Matrix;
    private x: math.Matrix;
    private pivotSequence: Array<number> = [];
    private tolerance: number = 1e-10;
    
    private inputRatio: Array<number> = [];
    private inputMask: Array<boolean> = [];
    private inputPrecision: Array<number>;

    public constructor(input: AlgorithmInput = structuredClone(AlgorithmInput.default)) {
        this.inputRatio = input.ratio;
        this.inputMask = input.mask;
        this.inputPrecision = input.precision;
        this.m = math.identity(this.inputRatio.length) as math.Matrix;
        this.x = math.matrix(this.inputRatio) as math.Matrix;
    }

    public setInput(input: AlgorithmInput): void {
        // assert(input.ratio.length === input.mask.length, 'Ratio length and mask length should be equal');

        this.inputRatio = input.ratio;
        this.inputMask = input.mask;
        this.inputPrecision = input.precision;
        this.reset();
    }


    public reset(): void {
        this.m = math.identity(this.inputRatio.length) as math.Matrix;
        this.x = math.matrix(this.inputRatio) as math.Matrix;
        this.pivotSequence = [];

        let ratio = math.matrix(this.inputRatio);
    }


    public step(): Array<number> | null {
        let possiblePivots = [];
        let mask = this.inputMask;
        let length = this.inputRatio.length;

        let pivots = this.findPivots();

        if (pivots.length == 0) {
            return null;
        }

        for (let pivot of pivots) {
            let [pivotRow, x_, precision] = this.pivotStep(pivot);
            let sum = math.sum(pivotRow) as number;
            possiblePivots.push([pivot, pivotRow, sum, x_, precision]);
        }

        // Usually there should be only one pivot. If there are multiple, we select the pivot with smallest sum. 
        possiblePivots.sort((a, b) => (a[2] as number) - (b[2] as number));
        while (possiblePivots[0][0] === this.getCurrentPivot()) {
            possiblePivots.shift();
        }

        let pivot = possiblePivots[0][0] as number;
        let pivotRow = possiblePivots[0][1] as math.Matrix;
        let inputPrecision = possiblePivots[0][4] as Array<number>;
        this.inputPrecision = inputPrecision;
        this.x = possiblePivots[0][3] as math.Matrix;

        for (let i = 0; i < length; i++) {
            this.m.set([pivot, i], pivotRow.get([i]));
        }

        this.pivotSequence.push(pivot);

        return Algorithm.vecToArray(pivotRow);
    }

    // Perform a pivot step. Returns the new pivot row and the new x vector.
    private pivotStep(pivot: number) : [math.Matrix, math.Matrix, Array<number>] {
        let length = this.inputRatio.length;
        let x_ = this.x.clone();
        let inputPrecision = this.inputPrecision;

        let pivotRow = math.flatten(this.m.subset(math.index(pivot, math.range(0, length)))) as math.Matrix;
        let x_p = this.x.get([pivot]);

        for (let i = 0; i < length; i++) {
            if (i != pivot) {
                // divmod of x[i] by x[pivot]
                let x_i = this.x.get([i]);
                let quotient = Math.floor(x_i / x_p);
                let remainder = x_i - quotient * x_p;

                // if we get too close to the next integer, we round up
                if (this.x.get([i]) - quotient * x_p  > x_p * (1. - this.inputPrecision[i])) {
                    quotient += 1;
                    remainder = 0;
                }
                inputPrecision[i] += quotient * this.inputPrecision[pivot];

                x_.set([i], remainder);

                // pivotRow += quotient * m[i, *]
                let m_i = math.flatten(this.m.subset(math.index(i, math.range(0, length)))) as math.Matrix;
                pivotRow = math.add(pivotRow, math.multiply(quotient, m_i)) as math.Matrix;
            }
        }

        // return m[pivot, *]
        return [pivotRow, x_, inputPrecision];
    }

    // Find the possible pivots. This is in general the smallest value in the x vector, but due to numerical issues, we also consider values that are close to the smallest value. 
    private findPivots(): Array<number> {
        let smallest = Infinity;
        let possiblePivots: Array<number> = [];
        let mask = this.inputMask;
        let length = this.inputRatio.length;

        let belowTolerance : number = 0;

        for (let i = 0; i < length; i++) {
            let value = this.x.get([i]);
            if (value < this.inputPrecision[i] || !mask[i]) {
                belowTolerance += 1;
                continue;
            }

            if (value < smallest) {
                smallest = value;
                possiblePivots = [i];
            } else if (value < smallest + this.inputPrecision[i]) {
                possiblePivots.push(i);
            }
        }

        if (belowTolerance == length - 1) {
            return [];
        }
        return possiblePivots;
    }

    private static vecToArray(v: math.Matrix): Array<number> {
        let result = [];
        for (let i = 0; i < v.size()[0]; i++) {
            result.push(v.get([i]));
        }
        return result;
    }

    
    // Additional Results

    public getCurrentPivot(): number {
        return this.pivotSequence[this.pivotSequence.length - 1];
    }

    public getPivotSequence(): Array<number> {
        return this.pivotSequence;
    }

    public getCurrentApproximation(): Array<number> {
        let pivot = this.pivotSequence[this.pivotSequence.length - 1];
        let length = this.inputRatio.length;

        let currentApproximation = [];
        for (let i = 0; i < length; i++) {
            currentApproximation.push(this.m.get([pivot, i]));
        }
        return currentApproximation;
    }

    public ratioFactor(): number {
        let currentApproximation = this.getCurrentApproximation();
        let values = this.inputRatio;

        let sum = (a: Array<number>):number => {
            let result = 0;
            for (let i = 0; i < a.length; i++) {
                if (this.inputMask[i]) {
                    result += a[i];
                }
            }
            return result;
        };

        let sumCurrentApproximation = sum(currentApproximation);
        let sumValues = sum(values);

        let factor = sumCurrentApproximation / sumValues;
        return factor
    }
}
