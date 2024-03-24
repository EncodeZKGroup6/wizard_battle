import { Struct, ZkProgram } from 'o1js';

export class ApplyPublicInput extends Struct({}) {}

export class ApplyPublicOutput extends Struct({}) {}

const proveApply = (publicInput: ApplyPublicInput): ApplyPublicOutput => {
  return new ApplyPublicOutput({});
};

export const ApplyProgramm = ZkProgram({
  name: 'state-proof',
  publicInput: ApplyPublicInput,
  publicOutput: ApplyPublicOutput,

  methods: {
    proveApply: {
      privateInputs: [],
      method: proveApply,
    },
  },
});

export class ProofOfApply extends ZkProgram.Proof(ApplyProgramm) {}
