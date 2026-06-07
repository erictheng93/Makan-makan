export class DurableObject<Env = unknown> {
  protected ctx: DurableObjectState;
  protected env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.ctx = state;
    this.env = env;
  }
}
