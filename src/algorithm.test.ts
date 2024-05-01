import { describe, expect, test } from '@jest/globals';
import { Algorithm, AlgorithmInput } from './algorithm';


function run_input(input: AlgorithmInput) {
    const algorithm = new Algorithm();
    algorithm.setInput(input);

    let outputs = [];
    while (true) {
        let output = algorithm.step();
        if (output === null) {
            break;
        }
        outputs.push(output);
    }
    return outputs;
}

test('Convergents of PI', () => {
    const algorithm = new Algorithm();

    let input = new AlgorithmInput();
    input.ratio = [3.14159, 1];
    input.mask = [true, true];
    input.precision = [5e-6, 5e-16];
    
    let outputs = run_input(input);

    expect(outputs).toContainEqual([3, 1]);
    expect(outputs).toContainEqual([22, 7]);
    expect(outputs).toContainEqual([333, 106]);
    expect(outputs).toContainEqual([355, 113]);
});

test('Oil Ratio', () => {
    const algorithm = new Algorithm();

    let input = new AlgorithmInput();
    input.ratio = [85.47, 72.65, 21.37];
    input.mask = [true, true, true];
    input.precision = [5e-3, 5e-3, 5e-3];
    algorithm.setInput(input);

    let outputs = run_input(input);

    expect(outputs).toContainEqual([4, 3, 1]);
    expect(outputs).toContainEqual([8, 7, 2]);
    expect(outputs).toContainEqual([20, 17, 5]);
});

test('Golden Ratio', () => {
    const algorithm = new Algorithm();

    let input = new AlgorithmInput();
    input.ratio = [1.61803398, 1];
    input.mask = [true, true];
    input.precision = [5e-8, 5e-8];
    algorithm.setInput(input);

    let outputs = run_input(input);

    expect(outputs).toContainEqual([1, 1]);
    expect(outputs).toContainEqual([2, 1]);
    expect(outputs).toContainEqual([3, 2]);
    expect(outputs).toContainEqual([5, 3]);
    expect(outputs).toContainEqual([8, 5]);
    expect(outputs).toContainEqual([13, 8]);
    expect(outputs).toContainEqual([21, 13]);
});

test('4D Ratio', () => {
    const algorithm = new Algorithm();

    let input = new AlgorithmInput();
    input.ratio = [20, 7, 17, 21.4];
    input.mask = [true, true, true, true];
    input.precision = [5e-8, 5e-8, 5e-8, 5e-15];
    algorithm.setInput(input);

    let outputs = run_input(input);
    
    expect(outputs).toContainEqual([100, 35, 85, 107]);
});