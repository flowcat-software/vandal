import { DEFAULT_STYLE_CONFIG } from "../../markup/styles";
import type { NumberPicker, StyleSettings } from "../../shared/ipc";
import type { ToolStyleItem } from "../schema";
import { useSettingsStore } from "../store";
import { DashStylesList } from "./DashStylesEditor";
import type { ControlProps } from "./index";
import { NumberPickerEditor } from "./NumberPickerEditor";
import { PaletteEditor } from "./PaletteEditor";
import { Segmented } from "./Segmented";
import { Switch } from "./Switch";
import styles from "./controls.module.css";

type ToolStyles = StyleSettings["tools"][string];

/** A tool's own way of showing colors (PLAN 3D.16), with its switch on. */
const COLOR_CONTROLS = [
  { value: "swatches", label: "Swatches" },
  { value: "dropdown", label: "Dropdown" },
] as const;

/**
 * Overrides switched off this session, by tool: switching back on brings
 * them back instead of starting over.
 */
const setAside = new Map<string, Partial<ToolStyles>>();

/**
 * One tool's own colors and widths (PLAN 2C.2): a switch for each, with its
 * palette / width editor under it while it's on. Off, the tool uses the
 * shared ones. Above them, how the tool shows its colors (PLAN 3D.16); below,
 * for tools with dashed strokes, the shared line styles or its own (PLAN 3X).
 */
export function ToolStyleSetting({ item, id, disabled }: ControlProps<ToolStyleItem>) {
  const settings = useSettingsStore((s) => s.settings!);
  const set = useSettingsStore((s) => s.set);
  const tools = settings.styles.tools;
  const own: ToolStyles = tools[item.tool] ?? {
    palette: null,
    width: null,
    colorControl: null,
    dashes: null,
  };
  const shipped = DEFAULT_STYLE_CONFIG.styles.tools[item.tool];

  const update = (patch: Partial<ToolStyles>) => {
    const next = { ...own, ...patch };
    const all = { ...tools };
    if (next.palette || next.width || next.colorControl || next.dashes) all[item.tool] = next;
    else delete all[item.tool];
    // The map of overrides is an object, which typed leaf paths don't reach.
    void set("styles.tools" as never, all as never);
  };

  const switchPalette = (on: boolean) => {
    if (!on) {
      setAside.set(item.tool, { ...setAside.get(item.tool), palette: own.palette });
      return update({ palette: null });
    }
    const palette = setAside.get(item.tool)?.palette ?? shipped?.palette ?? settings.styles.palette;
    update({ palette: [...palette] });
  };

  const switchWidth = (on: boolean) => {
    if (!on) {
      setAside.set(item.tool, { ...setAside.get(item.tool), width: own.width });
      return update({ width: null });
    }
    const width = setAside.get(item.tool)?.width ?? shipped?.width ?? settings.styles.width;
    update({ width: structuredClone(width) as NumberPicker });
  };

  const switchColorControl = (on: boolean) => {
    if (!on) {
      setAside.set(item.tool, { ...setAside.get(item.tool), colorControl: own.colorControl });
      return update({ colorControl: null });
    }
    // Starts from what it had, else the one for all tools.
    update({ colorControl: setAside.get(item.tool)?.colorControl ?? settings.styles.colorControl });
  };

  const switchDashes = (on: boolean) => {
    if (!on) {
      setAside.set(item.tool, { ...setAside.get(item.tool), dashes: own.dashes });
      return update({ dashes: null });
    }
    // Starts from what it had, else a copy of the shared list.
    const dashes = setAside.get(item.tool)?.dashes ?? settings.styles.dashes;
    update({ dashes: dashes.map((d) => ({ ...d })) });
  };

  return (
    <div className={styles.overrides} id={id}>
      <div className={styles.override}>
        <label className={styles.overrideSwitch}>
          <span className={styles.overrideLabel}>Custom color controls</span>
          <Switch
            checked={!!own.colorControl}
            disabled={disabled}
            label={`${item.label}: custom color controls`}
            onChange={switchColorControl}
          />
        </label>
        {own.colorControl && (
          <div className={styles.overridePanel}>
            <div className={styles.valueList}>
              <span className={styles.help}>Show colors as</span>
              <Segmented
                label={`${item.label}: show colors as`}
                options={COLOR_CONTROLS}
                value={own.colorControl}
                disabled={disabled}
                onChange={(colorControl) => update({ colorControl })}
              />
            </div>
          </div>
        )}
      </div>
      <div className={styles.override}>
        <label className={styles.overrideSwitch}>
          <span className={styles.overrideLabel}>Custom colors</span>
          <Switch
            checked={!!own.palette}
            disabled={disabled}
            label={`${item.label}: custom colors`}
            onChange={switchPalette}
          />
        </label>
        {own.palette && (
          <div className={styles.overridePanel}>
            <PaletteEditor
              colors={own.palette}
              label={`${item.label} colors`}
              disabled={disabled}
              onChange={(palette) => update({ palette })}
            />
          </div>
        )}
      </div>
      {item.widths && (
        <div className={styles.override}>
          <label className={styles.overrideSwitch}>
            <span className={styles.overrideLabel}>Custom line widths</span>
            <Switch
              checked={!!own.width}
              disabled={disabled}
              label={`${item.label}: custom line widths`}
              onChange={switchWidth}
            />
          </label>
          {own.width && (
            <div className={styles.overridePanel}>
              <NumberPickerEditor
                picker={own.width}
                label={`${item.label} width`}
                unit="px"
                lines
                disabled={disabled}
                onChange={(width) => update({ width })}
              />
            </div>
          )}
        </div>
      )}
      {item.dashes && (
        <div className={styles.override}>
          <label className={styles.overrideSwitch}>
            <span className={styles.overrideLabel}>Custom line styles</span>
            <Switch
              checked={!!own.dashes}
              disabled={disabled}
              label={`${item.label}: custom line styles`}
              onChange={switchDashes}
            />
          </label>
          {own.dashes && (
            <DashStylesList
              list={own.dashes}
              disabled={disabled}
              onChange={(dashes) => update({ dashes })}
            />
          )}
        </div>
      )}
    </div>
  );
}
