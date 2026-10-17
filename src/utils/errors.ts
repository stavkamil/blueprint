/** An expected failure the user can fix: `message` says what happened, `hint` says what to do next. */
export class BlueprintError extends Error {
  readonly hint: string;

  constructor(message: string, hint: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "BlueprintError";
    this.hint = hint;
  }
}
