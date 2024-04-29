import { Model } from './model';
import { Observer } from './observer';

/*  UrlGui class
    Serializes the state of the Model to the URL. Handles deserialization on URL change. UrlGui is a singleton class because there is only one URL.
*/
export class UrlGui implements Observer {
    private model: Model;
    private state: string = "";

    private static instance: UrlGui;

    public static initialize(model: Model): void {
        UrlGui.instance = new UrlGui(model);
    }

    public static getInstance(): UrlGui {
        if (!UrlGui.instance) {
            throw new Error('UrlGui not initialized.');
        }
        return UrlGui.instance;
    }


    public constructor(model: Model) {
        this.model = model;
        this.onURLChange();

        // Register URL change listener
        window.addEventListener('popstate', this.onURLChange.bind(this));
    }

    public onInputsChanged(): void { this.updateURL(); }
    public onStatusChanged(): void { }
    public onFinished(finished: boolean): void { }
    public onSettingsChanged(): void { this.updateURL(); }
    public onDataChanged(): void { }

    private updateURL(): void {
        let url = new URL(window.location.href);

        let serialized = this.model.serializeState();

        if (this.state == serialized) { return; }
        this.state = serialized;

        if (serialized == "") {
            url.searchParams.delete('state');
        } else {
            url.searchParams.set('state', serialized);
        }

        history.pushState({ model: serialized }, 'title', url.toString());
    }

    public onURLChange(): void {
        let url = new URL(window.location.href);
        let state = url.searchParams.get('state');
        if (state) {
            let success = this.model.deserializeState(state);
            if (!success) {
                this.updateURL();
            }
        }
    }
}
