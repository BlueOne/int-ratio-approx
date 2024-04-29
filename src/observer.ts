export interface Observer {
    onInputsChanged(): void;
    onFinished(finished: boolean): void;
    onSettingsChanged(): void;
    onDataChanged(): void;
}

export interface Observable {
    addObserver(observer: Observer): void;
    removeObserver(observer: Observer): void;
}
