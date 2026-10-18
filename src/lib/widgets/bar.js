// Thin vertical meter filled from the bottom, drawn like the shell's barLevel.js.
import Atk from 'gi://Atk';
import Cogl from 'gi://Cogl';
import GObject from 'gi://GObject';
import St from 'gi://St';

// GType names are prefixed: they are global to the shell process.
export class Bar extends St.DrawingArea {
    static {
        GObject.registerClass({GTypeName: 'XsmBar'}, this);
    }

    constructor(params) {
        super({
            style_class: 'xsm-bar',
            accessible_role: Atk.Role.LEVEL_BAR,
            y_expand: true,
            ...params,
        });
        this._fraction = 0;
        this._color = new Cogl.Color({red: 255, green: 255, blue: 255, alpha: 255});
        // Height and filled height at the last repaint.
        this._height = 0;
        this._drawnFill = -1;
    }

    setFraction(fraction) {
        this._fraction = Math.min(Math.max(fraction || 0, 0), 1);
        // Only when the fill changes by a whole pixel, as systemload's set_fraction().
        if (Math.round(this._fraction * this._height) !== this._drawnFill)
            this.queue_repaint();
    }

    // Any CSS colour: "#1c71d8", "rgba(28,113,216,0.8)".
    setColor(color) {
        const [ok, parsed] = Cogl.Color.from_string(color);
        if (!ok || this._color.equal(parsed))
            return;
        this._color = parsed;
        this.queue_repaint();
    }

    // As XFCE's GTK progress bar: the trough has the border, the fill covers it full width.
    vfunc_repaint() {
        const cr = this.get_context();
        const node = this.get_theme_node();
        const [width, height] = this.get_surface_size();
        const border = node.get_length('-xsm-border-width');

        cr.setSourceColor(node.get_color('-xsm-trough-color'));
        cr.rectangle(0, 0, width, height);
        cr.fill();
        if (border > 0) {
            cr.setSourceColor(node.get_color('-xsm-border-color'));
            cr.setLineWidth(border);
            cr.rectangle(border / 2, border / 2, width - border, height - border);
            cr.stroke();
        }

        this._height = height;
        this._drawnFill = Math.round(this._fraction * height);
        if (this._drawnFill > 0) {
            cr.setSourceColor(this._color);
            cr.rectangle(0, height - this._drawnFill, width, this._drawnFill);
            cr.fill();
        }
        cr.$dispose();
    }
}
