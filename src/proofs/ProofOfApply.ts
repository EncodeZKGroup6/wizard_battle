import { Field, Struct, ZkProgram } from 'o1js';

export class ApplyPublicInput extends Struct({
  actions: Field,
  state: Field,
}) {}

export class ApplyPublicOutput extends Struct({
  health: Field,
}) {}

/*
    This one should apply all spells from actions and return final health of wizard
*/
const proveApply = (
  publicInput: ApplyPublicInput,
  spell1: Field,
  spell2: Field,
  posX: Field,
  posY: Field
): ApplyPublicOutput => {
  return new ApplyPublicOutput({
    health: Field.from(0),
  });
};

export const ApplyProgramm = ZkProgram({
  name: 'state-proof',
  publicInput: ApplyPublicInput,
  publicOutput: ApplyPublicOutput,

  methods: {
    proveApply: {
      privateInputs: [Field, Field, Field, Field],
      method: proveApply,
    },
  },
});

export class ProofOfApply extends ZkProgram.Proof(ApplyProgramm) {}
