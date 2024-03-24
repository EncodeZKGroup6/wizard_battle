import { Field, Struct, ZkProgram } from 'o1js';
import { WizardState } from '../types';

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
  state: WizardState
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
      privateInputs: [WizardState],
      method: proveApply,
    },
  },
});

export class ProofOfApply extends ZkProgram.Proof(ApplyProgramm) {}
