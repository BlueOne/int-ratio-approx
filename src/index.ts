
import { Algorithm } from './algorithm';
import { Model, ModelInput } from './model';
import { Gui } from './gui';
import { UrlGui } from './urlgui';


class App {
    private algorithm: Algorithm;
    public model: Model;
    private gui: Gui;
    private urlGui: UrlGui;

    public constructor() {
        this.algorithm = new Algorithm();

        this.model = new Model(this.algorithm);

        UrlGui.initialize(this.model);
        this.urlGui = UrlGui.getInstance();
        this.model.addObserver(this.urlGui);

        Gui.initialize(this.model);
        this.gui = Gui.getInstance();
        this.model.addObserver(this.gui);

        this.model.restart();
    }

    public run(): void { }
}

(window as any).app = new App();

