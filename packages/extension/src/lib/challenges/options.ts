export type ChallengeOptionValue = string | number | boolean | Array<string | number>;
export type ChallengeOptionValues = Record<string, ChallengeOptionValue>;

export type ChallengeInstructions = {
  title?: string;
  summary?: string;
  steps?: string[];
  commands?: string[];
  note?: string;
};

export type OptionChoice<Value extends string | number> = {
  label: string;
  value: Value;
};

type OptionBase<Value, Kind extends string> = {
  type: Kind;
  label: string;
  default: Value;
  description?: string;
  when?: (settings: Record<string, unknown>) => boolean;
};

export type TextOption = OptionBase<string, "text"> & {
  placeholder?: string;
  multiline?: boolean;
};

export type NumberOption = OptionBase<number, "number"> & {
  min?: number;
  max?: number;
  step?: number;
};

export type SliderOption = OptionBase<number, "slider"> & {
  min: number;
  max: number;
  step?: number;
  marks?: readonly number[];
};

export type ToggleOption = OptionBase<boolean, "checkbox">;

export type SelectOption<Value extends string | number = string> = OptionBase<
  Value,
  "select" | "radio"
> & {
  options: readonly OptionChoice<Value>[];
};

export type MultiSelectOption<Value extends string | number = string> = OptionBase<
  Value[],
  "checkbox-group"
> & {
  options: readonly OptionChoice<Value>[];
};

export type OptionDefinition =
  | TextOption
  | NumberOption
  | SliderOption
  | ToggleOption
  | SelectOption
  | MultiSelectOption;

export type OptionDefinitions = Record<string, OptionDefinition>;

type OptionValueFromDef<Def> = Def extends OptionBase<infer Value, string> ? Value : never;

export type InferOptionValues<Options extends OptionDefinitions> = {
  [K in keyof Options]: OptionValueFromDef<Options[K]>;
};

export type ChallengeDefinition<Options extends OptionDefinitions = OptionDefinitions> = {
  label: string;
  description: string;
  title: string;
  instructions?: ChallengeInstructions;
  options: Options;
};

type ChoiceOptionKind = "select" | "radio";
type MultiChoiceOptionKind = "checkbox-group";

type ChoiceOptionDef<
  Options extends readonly OptionChoice<string | number>[],
  Kind extends ChoiceOptionKind,
> = OptionBase<Options[number]["value"], Kind> & {
  options: Options;
};

type MultiChoiceOptionDef<
  Options extends readonly OptionChoice<string | number>[],
  Kind extends MultiChoiceOptionKind,
> = OptionBase<Array<Options[number]["value"]>, Kind> & {
  options: Options;
};

const choiceOption = <
  Options extends readonly OptionChoice<string | number>[],
  Kind extends ChoiceOptionKind,
>(def: {
  type: Kind;
  label: string;
  description?: string;
  default: Options[number]["value"];
  options: Options;
}) => ({ ...def }) as ChoiceOptionDef<Options, Kind>;

export const selectOption = <Options extends readonly OptionChoice<string | number>[]>(def: {
  label: string;
  description?: string;
  default: Options[number]["value"];
  options: Options;
}) => choiceOption({ type: "select", ...def });

export const radioOption = <Options extends readonly OptionChoice<string | number>[]>(def: {
  label: string;
  description?: string;
  default: Options[number]["value"];
  options: Options;
}) => choiceOption({ type: "radio", ...def });

const multiChoiceOption = <
  Options extends readonly OptionChoice<string | number>[],
  Kind extends MultiChoiceOptionKind,
>(def: {
  type: Kind;
  label: string;
  description?: string;
  default: Array<Options[number]["value"]>;
  options: Options;
}) => ({ ...def }) as MultiChoiceOptionDef<Options, Kind>;

export const checkboxGroupOption = <Options extends readonly OptionChoice<string | number>[]>(def: {
  label: string;
  description?: string;
  default: Array<Options[number]["value"]>;
  options: Options;
}) => multiChoiceOption({ type: "checkbox-group", ...def });
